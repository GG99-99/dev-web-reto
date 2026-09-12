/*
  Warnings:

  - A unique constraint covering the columns `[cedula]` on the table `person` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `person` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "person_cedula_key" ON "person"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "person_email_key" ON "person"("email");
