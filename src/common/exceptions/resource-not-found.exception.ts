import { HttpException, HttpStatus } from '@nestjs/common';

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, identifier: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: `${resource} with id "${identifier}" was not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
