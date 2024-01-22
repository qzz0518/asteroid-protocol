import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: true,
  name: 'utcToLocal'
})
export class UtcToLocalPipe implements PipeTransform {
  transform(value: string): Date {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  }
}
