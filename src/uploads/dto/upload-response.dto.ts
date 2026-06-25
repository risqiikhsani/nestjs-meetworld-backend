import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    description:
      'Public URL of the uploaded object (provider-dependent: S3 or GCS).',
    example:
      'https://meetworld-uploads.s3.us-east-1.amazonaws.com/2026-06-18/abc.jpg',
  })
  url!: string;
}

export class UploadManyResponseDto {
  @ApiProperty({
    description: 'Public URLs in upload order (provider-dependent: S3 or GCS).',
    type: [String],
    example: [
      'https://meetworld-uploads.s3.us-east-1.amazonaws.com/2026-06-18/abc.jpg',
      'https://meetworld-uploads.s3.us-east-1.amazonaws.com/2026-06-18/def.jpg',
    ],
  })
  urls!: string[];
}
