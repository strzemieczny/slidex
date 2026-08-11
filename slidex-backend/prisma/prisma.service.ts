// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Wczytaj .env dla pewności, gdyby proces wystartował bez ConfigModule
dotenv.config();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private pool: Pool;

    constructor() {
        const connectionString = process.env.DATABASE_URL || 'postgresql://slidex_user:slidex_password@localhost:25432/slidex_db?schema=public';

        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);

        super({ adapter });
        this.pool = pool;
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }
}