import { MigrationInterface, QueryRunner } from 'typeorm';

export class Test1782097659419 implements MigrationInterface {
  name = 'Test1782097659419';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" ADD "likes" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD "shares" integer NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "shares"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "likes"`);
  }
}
