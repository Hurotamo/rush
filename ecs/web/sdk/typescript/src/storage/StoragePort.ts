import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';

export interface StoragePort {
    getData(address: PublicKey): Promise<Buffer | null>;
    getMultipleAccounts(addresses: PublicKey[]): Promise<(Buffer | null)[]>;
    sendTransaction(transaction: Transaction, signers: Keypair[]): Promise<string>;
    getConnection(): Connection;
    getProgramId(): PublicKey;
    createEntity(entityData: Buffer, payer: Keypair, worldName?: string): Promise<string>;
    getEntityDataById(entityId: string, worldName?: string): Promise<Buffer | null>;
    setEntityDataById(entityId: string, newData: Buffer, payer: Keypair, worldName?: string): Promise<string>;
    deleteEntityById(entityId: string, payer: Keypair, worldName?: string): Promise<string>;
} 