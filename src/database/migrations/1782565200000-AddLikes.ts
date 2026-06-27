import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLikes1782565200000 implements MigrationInterface {
  name = 'AddLikes1782565200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "likes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "author_id" uuid NOT NULL, "post_id" uuid NOT NULL, "comment_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_likes" PRIMARY KEY ("id"))`,
    );
    // The composite unique index also serves as a B-tree on `author_id`
    // (leftmost prefix), so there is no separate `idx_likes_author_id`.
    await queryRunner.query(
      `CREATE INDEX "idx_likes_post_id" ON "likes" ("post_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_likes_author_post" ON "likes" ("author_id", "post_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" ADD CONSTRAINT "FK_likes_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" ADD CONSTRAINT "FK_likes_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" ADD CONSTRAINT "FK_likes_comment" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "likes" DROP CONSTRAINT "FK_likes_comment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" DROP CONSTRAINT "FK_likes_post"`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" DROP CONSTRAINT "FK_likes_author"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_likes_author_post"`);
    await queryRunner.query(`DROP INDEX "public"."idx_likes_post_id"`);
    await queryRunner.query(`DROP TABLE "likes"`);
  }
}
