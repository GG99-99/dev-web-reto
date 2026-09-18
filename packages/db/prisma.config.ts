import {config} from 'dotenv';

import path from 'path'
import { defineConfig } from 'prisma/config'

config({ path: path.resolve(__dirname, '../../.env'), override: false })

 export default defineConfig({
   schema: 'prisma/schema.prisma',
   migrations: {
     path: 'prisma/migrations',
   },
   datasource: {
     url: process.env.DATABASE_URL,
   },
 })

// import "dotenv/config";
// import { definePrismaConfig } from "prisma/config";
// import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";

// export default definePrismaConfig({
//   orm: definePostgresConfig({
//     contract: "prisma/contract.prisma",
//     output: "generated/prisma8",
//     db: {
//       connection: process.env["DATABASE_URL"],
//     },
//   }),
// });