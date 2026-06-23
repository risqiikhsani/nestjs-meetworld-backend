import { MigrationInterface, QueryRunner } from 'typeorm';

export class Test1782097864008 implements MigrationInterface {
  name = 'Test1782097864008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "likes"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "shares"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" ADD "shares" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD "likes" integer NOT NULL`,
    );
  }
}
