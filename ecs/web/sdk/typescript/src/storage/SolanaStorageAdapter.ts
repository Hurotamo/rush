import { Connection, PublicKey, Transaction, AccountInfo, Keypair, SystemProgram, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { StoragePort } from './StoragePort';

/**
 * Custom error class for SolanaStorageAdapter to provide detailed error messages and codes.
 */
export class SolanaStorageError extends Error {
    public readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = 'SolanaStorageError';
        this.code = code;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SolanaStorageError);
        }
    }
}

export class SolanaStorageAdapter implements StoragePort {
    private connection: Connection;
    private programId: PublicKey;

    constructor(connectionOrUrl: Connection | string = 'https://api.sonic.game/devnet', programId: PublicKey | string = '8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt') {
        this.connection = typeof connectionOrUrl === 'string' ? new Connection(connectionOrUrl) : connectionOrUrl;
        this.programId = typeof programId === 'string' ? new PublicKey(programId) : programId;
    }

    public async getData(address: PublicKey): Promise<Buffer | null> {
        try {
            const accountInfo: AccountInfo<Buffer> | null = await this.connection.getAccountInfo(address);
            if (!accountInfo || !accountInfo.data) {
                throw new SolanaStorageError(`Account data not found for address ${address.toString()}`, 'DATA_FETCH_ERROR');
            }
            return accountInfo.data;
        } catch (error: any) {
            console.error('Error fetching data from SolanaStorageAdapter:', error);
            throw new SolanaStorageError(`Failed to fetch data for address ${address.toString()}: ${error.message}`, 'DATA_FETCH_ERROR');
        }
    }

    public async getMultipleAccounts(addresses: PublicKey[]): Promise<(Buffer | null)[]> {
        try {
            const accountsInfo: (AccountInfo<Buffer> | null)[] = await this.connection.getMultipleAccountsInfo(addresses);
            const results = accountsInfo.map((info, index) => {
                if (!info || !info.data) {
                    throw new SolanaStorageError(`Account data not found for address ${addresses[index].toString()}`, 'MULTIPLE_ACCOUNTS_FETCH_ERROR');
                }
                return info.data;
            });
            return results;
        } catch (error: any) {
            console.error('Error fetching multiple accounts from SolanaStorageAdapter:', error);
            throw new SolanaStorageError(`Failed to fetch multiple accounts: ${error.message}`, 'MULTIPLE_ACCOUNTS_FETCH_ERROR');
        }
    }

    public async sendTransaction(transaction: Transaction): Promise<string> {
        try {
            const signature = await this.connection.sendTransaction(transaction, []);
            await this.connection.confirmTransaction(signature, 'confirmed');
            return signature;
        } catch (error: any) {
            console.error('Error sending transaction from SolanaStorageAdapter:', error);
            throw new SolanaStorageError(`Transaction failed: ${error.message}`, 'TRANSACTION_SEND_ERROR');
        }
    }

    public getConnection(): Connection {
        return this.connection;
    }

    public getProgramId(): PublicKey {
        return this.programId;
    }

    public async createEntity(entityData: Buffer, payer: Keypair, worldName: string): Promise<string> {
        try {
            // Derive the world PDA using the world name and program ID
            const worldSeed = Buffer.from('world', 'utf8');
            const worldNameSeed = Buffer.from(worldName, 'utf8');
            const [worldPda, worldBump] = PublicKey.findProgramAddressSync(
                [worldSeed, worldNameSeed],
                this.programId
            );
            console.log(`Target World PDA: ${worldPda.toString()}`);

            // Create a new account for the entity
            const entityAccount = Keypair.generate();
            console.log(`New Entity Account: ${entityAccount.publicKey.toString()}`);

            // Get the minimum balance required for rent exemption
            const rentExemptionAmount = await this.connection.getMinimumBalanceForRentExemption(entityData.length);

            // Create a transaction to create the account and set the data
            const transaction = new Transaction().add(
                // Create account instruction
                SystemProgram.createAccount({
                    fromPubkey: payer.publicKey,
                    newAccountPubkey: entityAccount.publicKey,
                    lamports: rentExemptionAmount,
                    space: entityData.length,
                    programId: this.programId
                }),
                // Custom instruction to set data (assuming the program handles this)
                new TransactionInstruction({
                    keys: [
                        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                        { pubkey: entityAccount.publicKey, isSigner: false, isWritable: true },
                        { pubkey: worldPda, isSigner: false, isWritable: true }
                    ],
                    programId: this.programId,
                    data: entityData
                })
            );

            // Send and confirm the transaction using a custom method for testing
            const signature = await this.sendAndConfirmTransaction(transaction, [payer, entityAccount]);
            console.log(`Entity created successfully. Entity Account: ${entityAccount.publicKey.toString()}, Transaction: ${signature}`);
            return signature;
        } catch (error: any) {
            console.error('Error in SolanaStorageAdapter.createEntity:', error);
            throw new SolanaStorageError(`Failed to create entity: ${error.message}`, 'ENTITY_CREATE_ERROR');
        }
    }

    public async getEntityDataById(entityId: string, worldName: string): Promise<Buffer | null> {
        try {
            // Derive the entity PDA using the entity ID, world name, and program ID
            const entitySeed = Buffer.from(entityId, 'utf8');
            const worldSeed = Buffer.from(worldName, 'utf8');
            const entityPrefix = Buffer.from('entity', 'utf8');
            const [entityPda, _] = PublicKey.findProgramAddressSync(
                [entityPrefix, worldSeed, entitySeed],
                this.programId
            );
            console.log(`Derived Entity PDA for ID "${entityId}" in world "${worldName}": ${entityPda.toString()}`);

            // Fetch the account data
            const accountInfo = await this.connection.getAccountInfo(entityPda);
            if (!accountInfo || !accountInfo.data) {
                throw new SolanaStorageError(`Entity ${entityId} not found in world ${worldName}`, 'ENTITY_GET_ERROR');
            }
            return accountInfo.data;
        } catch (error: any) {
            console.error(`Error in SolanaStorageAdapter.getEntityDataById for entityId "${entityId}":`, error);
            throw new SolanaStorageError(`Failed to get entity data for ID ${entityId}: ${error.message}`, 'ENTITY_GET_ERROR');
        }
    }

    public async setEntityDataById(entityId: string, data: Buffer, payer: Keypair, worldName: string): Promise<string> {
        try {
            // Derive the entity PDA using the entity ID, world name, and program ID
            const entitySeed = Buffer.from(entityId, 'utf8');
            const worldSeed = Buffer.from(worldName, 'utf8');
            const entityPrefix = Buffer.from('entity', 'utf8');
            const [entityPda, _] = PublicKey.findProgramAddressSync(
                [entityPrefix, worldSeed, entitySeed],
                this.programId
            );
            console.log(`Target Entity PDA for update: ${entityPda.toString()}`);

            // Create a transaction to update the data
            const transaction = new Transaction().add(
                new TransactionInstruction({
                    keys: [
                        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                        { pubkey: entityPda, isSigner: false, isWritable: true }
                    ],
                    programId: this.programId,
                    data: data
                })
            );

            // Send and confirm the transaction using a custom method for testing
            const signature = await this.sendAndConfirmTransaction(transaction, [payer]);
            console.log(`Entity data updated successfully for PDA ${entityPda.toString()}. Transaction: ${signature}`);
            return signature;
        } catch (error: any) {
            console.error(`Error in SolanaStorageAdapter.setEntityDataById for entityId "${entityId}":`, error);
            throw new SolanaStorageError(`Failed to set entity data for ID ${entityId}: ${error.message}`, 'ENTITY_SET_ERROR');
        }
    }

    public async deleteEntityById(entityId: string, payer: Keypair, worldName: string): Promise<string> {
        try {
            // Derive the entity PDA using the entity ID, world name, and program ID
            const entitySeed = Buffer.from(entityId, 'utf8');
            const worldSeed = Buffer.from(worldName, 'utf8');
            const entityPrefix = Buffer.from('entity', 'utf8');
            const [entityPda, _] = PublicKey.findProgramAddressSync(
                [entityPrefix, worldSeed, entitySeed],
                this.programId
            );
            console.log(`Target Entity PDA for deletion: ${entityPda.toString()}`);

            // Create a transaction to delete the entity
            const transaction = new Transaction().add(
                new TransactionInstruction({
                    keys: [
                        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                        { pubkey: entityPda, isSigner: false, isWritable: true }
                    ],
                    programId: this.programId,
                    data: Buffer.from([]) // Assuming empty data for delete instruction
                })
            );

            // Send and confirm the transaction using a custom method for testing
            const signature = await this.sendAndConfirmTransaction(transaction, [payer]);
            console.log(`Entity deleted successfully for PDA ${entityPda.toString()}. Transaction: ${signature}`);
            return signature;
        } catch (error: any) {
            console.error(`Error in SolanaStorageAdapter.deleteEntityById for entityId "${entityId}":`, error);
            throw new SolanaStorageError(`Failed to delete entity with ID ${entityId}: ${error.message}`, 'ENTITY_DELETE_ERROR');
        }
    }

    public async migrate(worldName: string, payer: Keypair): Promise<string> {
        try {
            // Derive the world PDA using the world name and program ID
            const worldSeed = Buffer.from(worldName, 'utf8');
            const [worldPda, worldBump] = PublicKey.findProgramAddressSync(
                [worldSeed],
                this.programId
            );
            console.log(`Migrating World PDA: ${worldPda.toString()}`);

            // Create a transaction to initialize or update the world
            const transaction = new Transaction().add(
                new TransactionInstruction({
                    keys: [
                        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                        { pubkey: worldPda, isSigner: false, isWritable: true }
                    ],
                    programId: this.programId,
                    data: Buffer.from([worldBump]) // Include bump in data if needed by program
                })
            );

            // Send and confirm the transaction using a custom method for testing
            const signature = await this.sendAndConfirmTransaction(transaction, [payer]);
            console.log(`World migrated successfully. Transaction: ${signature}`);
            return signature;
        } catch (error: any) {
            console.error('Error in SolanaStorageAdapter.migrate:', error);
            throw new SolanaStorageError(`Failed to migrate world: ${error.message}`, 'WORLD_MIGRATE_ERROR');
        }
    }

    // Add a custom method for sending and confirming transactions that can be mocked in tests
    private async sendAndConfirmTransaction(transaction: Transaction, signers: Keypair[]): Promise<string> {
        try {
            // Use the connection's sendTransaction method
            const signature = await this.connection.sendTransaction(transaction, signers);
            // Confirm the transaction
            await this.connection.confirmTransaction(signature, 'confirmed');
            return signature;
        } catch (error: any) {
            throw new SolanaStorageError(`Transaction failed: ${error.message}`, 'TRANSACTION_SEND_ERROR');
        }
    }
} 