package metaprotocol

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"mime"
	"net/url"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/donovansolms/cosmos-inscriptions/indexer/src/indexer/models"
	"github.com/donovansolms/cosmos-inscriptions/indexer/src/indexer/types"
	"github.com/kelseyhightower/envconfig"
	"github.com/leodido/go-urn"
	"gorm.io/gorm"
)

type CFT20Config struct {
	S3Endpoint string `envconfig:"S3_ENDPOINT" required:"true"`
	S3Region   string `envconfig:"S3_REGION" required:"true"`
	S3Bucket   string `envconfig:"S3_BUCKET"`
	S3ID       string `envconfig:"S3_ID" required:"true"`
	S3Secret   string `envconfig:"S3_SECRET" required:"true"`
	S3Token    string `envconfig:"S3_TOKEN"`
}

type CFT20 struct {
	chainID    string
	db         *gorm.DB
	s3Endpoint string
	s3Region   string
	s3Bucket   string
	// s3ID is the S3 credentials ID
	s3ID string
	// s3Secret is the S3 credentials secret
	s3Secret string
	// s3Token is the S3 credentials token
	s3Token string
	// Define protocol rules
	nameMinLength          int
	nameMaxLength          int
	tickerMinLength        int
	tickerMaxLength        int
	decimalsMaxValue       uint
	maxSupplyMaxValue      uint64
	perWalletLimitMaxValue uint64
}

func NewCFT20Processor(chainID string, db *gorm.DB) *CFT20 {
	// Parse config environment variables for self
	var config InscriptionConfig
	err := envconfig.Process("", &config)
	if err != nil {
		log.Fatalf("Unable to process config: %s", err)
	}

	return &CFT20{
		chainID:                chainID,
		db:                     db,
		s3Endpoint:             config.S3Endpoint,
		s3Region:               config.S3Region,
		s3Bucket:               config.S3Bucket,
		s3ID:                   config.S3ID,
		s3Secret:               config.S3Secret,
		s3Token:                config.S3Token,
		nameMinLength:          3,
		nameMaxLength:          32,
		tickerMinLength:        3,
		tickerMaxLength:        5,
		decimalsMaxValue:       6,
		maxSupplyMaxValue:      math.MaxUint64,
		perWalletLimitMaxValue: math.MaxUint64,
	}
}

func (protocol *CFT20) Name() string {
	return "cft20"
}

func (protocol *CFT20) Process(protocolURN *urn.URN, rawTransaction types.RawTransaction) error {
	sender, err := rawTransaction.GetSenderAddress()
	if err != nil {
		return err
	}

	// We need to parse the protocol specific string in SS, it contains
	// {chainId}@{version};operation$h={unique hash of content}
	// cosmoshub-4@v1beta;deploy$nam=The Name,tic=TICK,sup=21000000,dec=6,lim=1000
	// cosmoshub-4@v1beta;deploy$nam=NewYearDay,tic=NYD,sup=28000000,dec=18,lim=50000,opn=1704059940
	parsedURN, err := ParseProtocolString(protocolURN)
	if err != nil {
		return err
	}

	if parsedURN.ChainID != protocol.chainID {
		return fmt.Errorf("chain ID in protocol string does not match transaction chain ID")
	}

	height, err := strconv.ParseUint(rawTransaction.TxResponse.Height, 10, 64)
	if err != nil {
		return fmt.Errorf("unable to parse height '%s'", err)
	}

	// TODO: Rework the operation handling
	switch parsedURN.Operation {
	case "deploy":
		name, err := url.QueryUnescape(strings.TrimSpace(parsedURN.KeyValuePairs["nam"]))
		if err != nil {
			return fmt.Errorf("unable to parse token name '%s'", err)
		}
		ticker := strings.TrimSpace(parsedURN.KeyValuePairs["tic"])
		ticker = strings.ToUpper(ticker)

		supply, err := strconv.ParseUint(parsedURN.KeyValuePairs["sup"], 10, 64)
		if err != nil {
			return fmt.Errorf("unable to parse supply '%s'", err)
		}
		decimals, err := strconv.ParseUint(parsedURN.KeyValuePairs["dec"], 10, 64)
		if err != nil {
			return fmt.Errorf("unable to parse decimals '%s'", err)
		}
		limit, err := strconv.ParseUint(parsedURN.KeyValuePairs["lim"], 10, 64)
		if err != nil {
			return fmt.Errorf("unable to parse limit '%s'", err)
		}

		openTimestamp, err := strconv.ParseUint(parsedURN.KeyValuePairs["opn"], 10, 64)
		if err != nil {
			// If this fails, we set the open time to the block time
			openTimestamp = uint64(rawTransaction.TxResponse.Timestamp.Unix())
		}

		// Add the decimals to the supply and limit
		supply = supply * uint64(math.Pow10(int(decimals)))
		limit = limit * uint64(math.Pow10(int(decimals)))

		// TODO: Rework validation
		// Validate some fields
		if len(name) < protocol.nameMinLength || len(name) > protocol.nameMaxLength {
			return fmt.Errorf("token name must be between %d and %d characters", protocol.nameMinLength, protocol.nameMaxLength)
		}
		if len(ticker) < protocol.tickerMinLength || len(ticker) > protocol.tickerMaxLength {
			return fmt.Errorf("token ticker must be between %d and %d characters", protocol.tickerMinLength, protocol.tickerMaxLength)
		}
		if decimals > uint64(protocol.decimalsMaxValue) {
			return fmt.Errorf("token decimals must be less than %d", protocol.decimalsMaxValue)
		}
		if supply > protocol.maxSupplyMaxValue {
			return fmt.Errorf("token supply must be less than %d", protocol.maxSupplyMaxValue)
		}
		if limit > supply {
			return fmt.Errorf("token per wallet limit must be less than supply of %d", protocol.maxSupplyMaxValue)
		}

		// Check if this token has already been deployed
		var tokenModel models.Token
		result := protocol.db.Where("chain_id = ? AND ticker = ?", parsedURN.ChainID, ticker).First(&tokenModel)
		if result.Error == nil {
			return fmt.Errorf("token with ticker '%s' already exists", name)
		}

		// TODO: Rework the content extraction
		contentPath := ""
		contentLength := 0
		// If this token includes content, we need to store it and add to the record
		if len(rawTransaction.Tx.Body.NonCriticalExtensionOptions) == 1 {
			// Logo is stored in the non_critical_extension_options
			// section of the transaction
			var logoContent []byte
			var metadata []byte
			for _, extension := range rawTransaction.Tx.Body.NonCriticalExtensionOptions {
				// The type of the option must be MsgRevoke
				if extension.Type == "/cosmos.authz.v1beta1.MsgRevoke" {
					// The granter field contains the metadata
					metadata, err = base64.StdEncoding.DecodeString(extension.Granter)
					if err != nil {
						return fmt.Errorf("unable to decode granter metadata '%s'", err)
					}
					// The grantee field contains the content base64
					logoContent, err = base64.StdEncoding.DecodeString(extension.Grantee)
					if err != nil {
						return fmt.Errorf("unable to decode grantee content '%s'", err)
					}

					// We only process the first extension option
					break
				}
			}

			var inscriptionMetadata InscriptionMetadata
			err = json.Unmarshal(metadata, &inscriptionMetadata)
			if err != nil {
				return fmt.Errorf("unable to unmarshal metadata '%s'", err)
			}

			// Store the content with the correct mime type on DO
			contentPath, err = protocol.storeContent(inscriptionMetadata, rawTransaction.TxResponse.Txhash, logoContent)
			if err != nil {
				return fmt.Errorf("unable to store content '%s'", err)
			}

			contentLength = len(logoContent)
		}

		// Create the token model
		tokenModel = models.Token{
			ChainID:           parsedURN.ChainID,
			Height:            height,
			Version:           parsedURN.Version,
			TransactionHash:   rawTransaction.TxResponse.Txhash,
			Creator:           sender,
			CurrentOwner:      sender,
			Name:              name,
			Ticker:            ticker,
			Decimals:          decimals,
			MaxSupply:         supply,
			PerWalletLimit:    limit,
			LaunchTimestamp:   openTimestamp,
			ContentPath:       contentPath,
			ContentSizeBytes:  uint64(contentLength),
			DateCreated:       rawTransaction.TxResponse.Timestamp,
			CirculatingSupply: 0,
		}

		result = protocol.db.Save(&tokenModel)
		if result.Error != nil {
			return result.Error
		}

	case "mint":
		ticker := strings.TrimSpace(parsedURN.KeyValuePairs["tic"])
		ticker = strings.ToUpper(ticker)

		// Check if the ticker exists
		var tokenModel models.Token
		result := protocol.db.Where("chain_id = ? AND ticker = ?", parsedURN.ChainID, ticker).First(&tokenModel)
		if result.Error != nil {
			return fmt.Errorf("token with ticker '%s' doesn't exist", ticker)
		}
		// Check if the minted <= max supply
		if tokenModel.CirculatingSupply >= tokenModel.MaxSupply {
			return fmt.Errorf("token with ticker '%s' has reached max supply", ticker)
		}
		// Check if opn time < transaction time
		if tokenModel.LaunchTimestamp > uint64(rawTransaction.TxResponse.Timestamp.Unix()) {
			return fmt.Errorf("token with ticker '%s' is not yet open for minting", ticker)
		}

		// TODO: Check if the sender has minted <= max per wallet
		var addressMinted int64
		row := protocol.db.Table("token_address_history").Where("chain_id = ? AND ticker = ? AND sender = ? AND action = 'mint'", parsedURN.ChainID, ticker, sender).Select("sum(amount)").Row()
		row.Scan(&addressMinted)

		mintAmount := tokenModel.PerWalletLimit

		// TODO Check that minted + new mint <= max supply

		// Add to tx history
		historyModel := models.TokenAddressHistory{
			ChainID:         parsedURN.ChainID,
			Height:          height,
			TransactionHash: rawTransaction.TxResponse.Txhash,
			Ticker:          ticker,
			Sender:          sender,
			Action:          "mint",
			Amount:          mintAmount,
			DateCreated:     rawTransaction.TxResponse.Timestamp,
		}
		result = protocol.db.Save(&historyModel)
		if result.Error != nil {
			return result.Error
		}

		// Update token circulating
		tokenModel.CirculatingSupply = tokenModel.CirculatingSupply + tokenModel.PerWalletLimit
		result = protocol.db.Save(&tokenModel)
		if result.Error != nil {
			return result.Error
		}

		// Update user balance
		var holderModel models.TokenHolder
		result = protocol.db.Where("chain_id = ? AND ticker = ? AND address = ?", parsedURN.ChainID, ticker, sender).First(&holderModel)
		if result.Error != nil {
			if result.Error != gorm.ErrRecordNotFound {
				return result.Error
			}
		}

		holderModel = models.TokenHolder{
			ChainID:     parsedURN.ChainID,
			Ticker:      ticker,
			Address:     sender,
			Amount:      holderModel.Amount + mintAmount,
			DateUpdated: rawTransaction.TxResponse.Timestamp,
		}

		result = protocol.db.Save(&holderModel)
		if result.Error != nil {
			return result.Error
		}

	case "transfer":
		fmt.Println("TRANSFER TOKEN!")
	}

	_ = height

	_ = sender

	return nil
}

// TODO: This is reused, move to common helpers
// storeContent stores the content in the S3 bucket
func (protocol *CFT20) storeContent(metadata InscriptionMetadata, txHash string, content []byte) (string, error) {
	ext, err := mime.ExtensionsByType(metadata.Metadata.Mime)
	if err != nil {
		// We could not find the mime type, so we default to .bin
		ext = []string{".bin"}
	}

	endpoint := protocol.s3Endpoint
	region := protocol.s3Region
	sess := session.Must(session.NewSession(&aws.Config{
		Endpoint:    &endpoint,
		Region:      &region,
		Credentials: credentials.NewStaticCredentials(protocol.s3ID, protocol.s3Secret, protocol.s3Token),
	}))

	// Create an uploader with the session and default options
	uploader := s3manager.NewUploader(sess)

	// Upload the file to an S3 compatible bucket
	myBucket := protocol.s3Bucket
	filename := txHash + ext[0]
	uploadResult, err := uploader.Upload(&s3manager.UploadInput{
		ACL:    aws.String("public-read"),
		Bucket: aws.String(myBucket),
		Key:    aws.String(filename),
		Body:   bytes.NewReader(content),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload file, %v", err)
	}

	return aws.StringValue(&uploadResult.Location), nil
}
