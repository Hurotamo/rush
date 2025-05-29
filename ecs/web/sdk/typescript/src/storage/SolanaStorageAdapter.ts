import { Connection, PublicKey, Transaction, AccountInfo, Keypair, SystemProgram, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { StoragePort } from './StoragePort';

export class SolanaStorageAdapter implements StoragePort {
    private connection: Connection;
    private programId: PublicKey;

    constructor(connection: Connection, programId: PublicKey) {
        this.connection = connection;
        this.programId = programId;
    }

    public async getData(address: PublicKey): Promise<Buffer | null> {
        try {
            const accountInfo: AccountInfo<Buffer> | null = await this.connection.getAccountInfo(address);
            return accountInfo?.data || null;
        } catch (error) {
            console.error('Error fetching data from SolanaStorageAdapter:', error);
            return null;
        }
    }

    public async getMultipleAccounts(addresses: PublicKey[]): Promise<(Buffer | null)[]> {
        try {
            const accountsInfo: (AccountInfo<Buffer> | null)[] = await this.connection.getMultipleAccountsInfo(addresses);
            return accountsInfo.map(accountInfo => accountInfo?.data || null);
        } catch (error) {
            console.error('Error fetching multiple accounts from SolanaStorageAdapter:', error);
            return new Array(addresses.length).fill(null);
        }
    }

    public async sendTransaction(transaction: Transaction): Promise<string> {
        try {
            // Note: sendAndConfirmTransaction is often preferred for simplicity if you have the wallet Keypair here.
            // However, the StoragePort might be used in contexts without direct wallet access for signing.
            // This implementation assumes the transaction is already signed if necessary.
            const signature = await this.connection.sendTransaction(transaction, []);
            // Confirmation logic might be handled by the caller or a higher-level service.
            // For robustness, you might want to make confirmation optional or configurable.
            await this.connection.confirmTransaction(signature, 'confirmed'); // Using a common commitment level
            return signature;
        } catch (error) {
            console.error('Error sending transaction from SolanaStorageAdapter:', error);
            throw error; // Re-throw to allow caller to handle
        }
    }

    public getConnection(): Connection {
        return this.connection;
    }

    public getProgramId(): PublicKey {
        return this.programId;
    }

    public async createEntity(entityData: Buffer, payer: Keypair, worldName: string = "default_world"): Promise<string> {
        try {
            const connection = this.getConnection();
            const programId = this.getProgramId();

            // 1. Derive World PDA (assuming a convention)
            // This is inspired by the `migrate` function in the older Storage class.
            // The actual seeds and derivation logic must match your on-chain program.
            const [worldPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("world"),       // Seed for "world"
                    Buffer.from(worldName),   // Seed for the specific world name/id
                    // programId.toBuffer()    // Optional: programId as seed if your program uses it for world PDA
                ],
                programId
            );
            console.log(`Target World PDA: ${worldPDA.toBase58()}`);

            // 2. Prepare a new account for the entity
            const entityAccount = Keypair.generate();
            console.log(`New Entity Account: ${entityAccount.publicKey.toBase58()}`);

            const transaction = new Transaction();

            // 3. Instruction to create the entity account (SystemProgram.createAccount)
            // This is if the entity itself is a new account. Size needs to be appropriate for entityData.
            const lamportsForEntityAccount = await connection.getMinimumBalanceForRentExemption(entityData.length);
            transaction.add(
                SystemProgram.createAccount({
                    fromPubkey: payer.publicKey,
                    newAccountPubkey: entityAccount.publicKey,
                    lamports: lamportsForEntityAccount,
                    space: entityData.length,
                    programId: programId, // The new entity account will be owned by our program
                })
            );

            // 4. Instruction to call the program to initialize/create the entity
            // This instruction's data and keys are specific to your on-chain program.
            // Placeholder instruction:
            const createEntityInstruction = new TransactionInstruction({
                keys: [
                    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                    { pubkey: worldPDA, isSigner: false, isWritable: true }, // World account, to be modified
                    { pubkey: entityAccount.publicKey, isSigner: false, isWritable: true }, // New entity account
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // System program if needed by CPIs
                    // Add other accounts as required by your program's instruction
                ],
                programId: programId,
                data: entityData, // The actual data for the new entity (e.g., component values)
            });
            transaction.add(createEntityInstruction);

            // Signers: payer + the new entityAccount Keypair (since it's used in createAccount)
            // However, entityAccount.publicKey is the newAccountPubkey, so entityAccount itself signs implicitly for its creation.
            // Payer is the primary signer for the transaction costs and the createEntityInstruction if it requires payer signature.
            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [payer, entityAccount] // Payer and the new entity account's keypair
            );

            console.log(`Entity created successfully. Entity Account: ${entityAccount.publicKey.toBase58()}, Transaction: ${signature}`);
            return signature;
        } catch (error) {
            console.error('Error in SolanaStorageAdapter.createEntity:', error);
            if (error instanceof Error) {
                throw new Error(`Failed to create entity: ${error.message}`);
            }
            throw new Error('Failed to create entity due to an unknown error.');
        }
    }

    public async getEntityDataById(entityId: string, worldName: string = "default_world"): Promise<Buffer | null> {
        try {
            const programId = this.getProgramId();

            // Derive the PDA for the entity account
            // The seeds must match how your on-chain program derives entity PDAs.
            // Common seeds might include "entity", world name/ID, and the entity's unique ID.
            const [entityPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("entity"),      // Seed for identifying an entity
                    Buffer.from(worldName),   // Seed for the world the entity belongs to
                    Buffer.from(entityId),    // Seed for the specific entity ID
                ],
                programId
            );
            console.log(`Derived Entity PDA for ID "${entityId}" in world "${worldName}": ${entityPDA.toBase58()}`);

            // Use the existing getData method to fetch account info at the derived PDA
            return await this.getData(entityPDA);
        } catch (error) {
            console.error(`Error in SolanaStorageAdapter.getEntityDataById for entityId "${entityId}":`, error);
            // Optionally, you might want to distinguish between "not found" and other errors.
            // For now, re-throwing or returning null is common.
            if (error instanceof Error) {
                // Consider if specific error messages are needed or if null is sufficient for "not found"
                // For example, if findProgramAddressSync fails or getData returns an error that isn't just "account not found".
            }
            return null; // Return null if entity not found or an error occurs
        }
    }

    public async setEntityDataById(entityId: string, newData: Buffer, payer: Keypair, worldName: string = "default_world"): Promise<string> {
        try {
            const connection = this.getConnection();
            const programId = this.getProgramId();

            // 1. Derive the PDA for the entity account
            const [entityPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("entity"),
                    Buffer.from(worldName),
                    Buffer.from(entityId),
                ],
                programId
            );
            console.log(`Target Entity PDA for update: ${entityPDA.toBase58()}`);

            // 2. Construct the instruction to update the entity's data
            // This instruction's data and keys are specific to your on-chain program.
            // It should take the newData and update the account at entityPDA.
            const updateEntityInstruction = new TransactionInstruction({
                keys: [
                    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // Payer
                    { pubkey: entityPDA, isSigner: false, isWritable: true },       // Entity account to update
                    // Add other accounts as required by your program's update instruction
                    // e.g., the worldPDA if the update also needs to modify world state, or if entityPDA is derived from worldPDA+entityId
                ],
                programId: programId,
                data: newData, // The new, serialized data for the entity
            });

            const transaction = new Transaction().add(updateEntityInstruction);

            // 3. Send and confirm the transaction
            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [payer] // Only payer needs to sign, assuming entityPDA is not a signer for its own update
            );

            console.log(`Entity data updated successfully for PDA ${entityPDA.toBase58()}. Transaction: ${signature}`);
            return signature;
        } catch (error) {
            console.error(`Error in SolanaStorageAdapter.setEntityDataById for entityId "${entityId}":`, error);
            if (error instanceof Error) {
                throw new Error(`Failed to set entity data: ${error.message}`);
            }
            throw new Error('Failed to set entity data due to an unknown error.');
        }
    }

    public async deleteEntityById(entityId: string, payer: Keypair, worldName: string = "default_world"): Promise<string> {
        try {
            const connection = this.getConnection();
            const programId = this.getProgramId();

            // 1. Derive the PDA for the entity account to be deleted
            const [entityPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("entity"),
                    Buffer.from(worldName),
                    Buffer.from(entityId),
                ],
                programId
            );
            console.log(`Target Entity PDA for deletion: ${entityPDA.toBase58()}`);

            // 2. Construct the instruction to delete the entity's data/account
            // This instruction's data and keys are specific to your on-chain program.
            // It should tell the program to close the account at entityPDA and transfer lamports to the payer (or a designated receiver).
            const deleteEntityInstruction = new TransactionInstruction({
                keys: [
                    { pubkey: payer.publicKey, isSigner: true, isWritable: true },  // Payer, also receiver of lamports
                    { pubkey: entityPDA, isSigner: false, isWritable: true },        // Entity account to close
                    // Add other accounts as required by your program's delete instruction
                    // e.g., the worldPDA if the delete also needs to modify world state (like removing from a list)
                    // { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // If CPIs to SystemProgram are involved directly (less common for simple close)
                ],
                programId: programId,
                data: Buffer.from([]), // Often, delete instructions might not need data, or might take an identifier if not clear from PDA
            });

            const transaction = new Transaction().add(deleteEntityInstruction);

            // 3. Send and confirm the transaction
            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [payer] // Payer signs the transaction
            );

            console.log(`Entity deleted successfully for PDA ${entityPDA.toBase58()}. Transaction: ${signature}`);
            return signature;
        } catch (error) {
            console.error(`Error in SolanaStorageAdapter.deleteEntityById for entityId "${entityId}":`, error);
            if (error instanceof Error) {
                throw new Error(`Failed to delete entity: ${error.message}`);
            }
            throw new Error('Failed to delete entity due to an unknown error.');
        }
    }
} 