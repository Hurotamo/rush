/// <reference types="jest" />
// Define mocks before jest.mock uses them
const mockFindProgramAddressSync = jest.fn();
const mockSendAndConfirmTransaction = jest.fn();

import { Connection, PublicKey, Transaction, Keypair, AccountInfo, SystemProgram, TransactionInstruction, sendAndConfirmTransaction as originalSendAndConfirmTransaction } from '@solana/web3.js';
import { SolanaStorageAdapter } from '../src/storage/SolanaStorageAdapter'; // Adjusted path
import { StoragePort } from '../src/storage/StoragePort';              // Adjusted path

jest.mock('@solana/web3.js', () => {
    const actualWeb3 = jest.requireActual('@solana/web3.js');
    const mockPublicKey = jest.fn().mockImplementation((...args) => {
        return {
            toString: () => args[0] || 'MockPublicKey',
            toBase58: () => args[0] || 'MockPublicKey',
            toBuffer: () => {
                const buffer = new Uint8Array(32);
                buffer.fill(1); // Fill with dummy data
                return buffer;
            },
            equals: (other: any) => other && other.toString() === (args[0] || 'MockPublicKey')
        };
    }) as jest.Mock & { findProgramAddressSync: jest.Mock };
    mockPublicKey.findProgramAddressSync = mockFindProgramAddressSync;
    const mockSystemProgram = {
        ...actualWeb3.SystemProgram,
        createAccount: jest.fn().mockImplementation(() => {
            return new actualWeb3.TransactionInstruction({
                keys: [],
                programId: actualWeb3.SystemProgram.programId,
                data: Buffer.from([])
            });
        })
    };
    const mockSendAndConfirmTransaction = jest.fn().mockImplementation((connection, transaction, signers) => {
        return Promise.resolve('mocksigCreateEntity11111111111111111111111111111111111111111111');
    });
    return {
        ...actualWeb3,
        PublicKey: mockPublicKey,
        SystemProgram: mockSystemProgram,
        sendAndConfirmTransaction: mockSendAndConfirmTransaction, // Mock this function
    };
});

// Mock a basic Solana connection and some functionalities
const mockGetAccountInfo = jest.fn();
const mockGetMultipleAccountsInfo = jest.fn();
const mockSendTransaction = jest.fn();
const mockConfirmTransaction = jest.fn();
const mockGetMinimumBalanceForRentExemption = jest.fn().mockResolvedValue(1000000); // Example lamports

// Reset mocks before each test
beforeEach(() => {
    mockGetAccountInfo.mockReset();
    mockGetMultipleAccountsInfo.mockReset();
    mockSendTransaction.mockReset().mockImplementation((transaction, signers) => Promise.resolve('mocksig1111111111111111111111111111111111111111111111111111111111111'));
    mockConfirmTransaction.mockReset().mockImplementation(() => Promise.resolve({}));
    mockGetMinimumBalanceForRentExemption.mockResolvedValue(1000000);
    mockFindProgramAddressSync.mockReset();
    mockSendAndConfirmTransaction.mockReset().mockImplementation((connection, transaction, signers) => {
        return Promise.resolve('mocksigCreateEntity11111111111111111111111111111111111111111111');
    });
});

const mockConnection = {
    getAccountInfo: mockGetAccountInfo,
    getMultipleAccountsInfo: mockGetMultipleAccountsInfo,
    sendTransaction: mockSendTransaction,
    confirmTransaction: mockConfirmTransaction,
    getMinimumBalanceForRentExemption: mockGetMinimumBalanceForRentExemption,
} as unknown as Connection;

describe('SolanaStorageAdapter', () => {
    const programId = new PublicKey('Pgm111111111111111111111111111111111111111');
    let storageAdapter: SolanaStorageAdapter; // Use concrete type for testing all methods

    beforeEach(() => {
        storageAdapter = new SolanaStorageAdapter(mockConnection, programId);
    });

    test('should get programId', () => {
        expect(storageAdapter.getProgramId()).toBe(programId);
    });

    test('should get connection', () => {
        expect(storageAdapter.getConnection()).toBe(mockConnection);
    });

    describe('getData', () => {
        test('should fetch and return account data', async () => {
            const address = new PublicKey('Acc111111111111111111111111111111111111111');
            const mockDataBuffer = Buffer.from('mock account data');
            mockGetAccountInfo.mockResolvedValueOnce({ data: mockDataBuffer } as AccountInfo<Buffer>);

            const data = await storageAdapter.getData(address);
            expect(data).toEqual(mockDataBuffer);
            expect(mockGetAccountInfo).toHaveBeenCalledWith(address);
        });

        test('should return null if account does not exist or has no data', async () => {
            const address = new PublicKey('Acc222222222222222222222222222222222222222');
            mockGetAccountInfo.mockResolvedValueOnce(null);
            let data = await storageAdapter.getData(address);
            expect(data).toBeNull();

            mockGetAccountInfo.mockResolvedValueOnce({ data: null } as unknown as AccountInfo<Buffer>); 
            data = await storageAdapter.getData(address);
            expect(data).toBeNull();
        });

        test('should return null and log error on fetch failure', async () => {
            const address = new PublicKey('Acc333333333333333333333333333333333333333');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGetAccountInfo.mockRejectedValueOnce(new Error('Fetch failed'));

            const data = await storageAdapter.getData(address);
            expect(data).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching data from SolanaStorageAdapter:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    describe('getMultipleAccounts', () => {
        test('should fetch and return data for multiple accounts', async () => {
            const address1 = new PublicKey('MltAcc111111111111111111111111111111111111');
            const address2 = new PublicKey('MltAcc222222222222222222222222222222222222');
            const mockDataBuffer1 = Buffer.from('data1');
            const mockDataBuffer2 = Buffer.from('data2');

            mockGetMultipleAccountsInfo.mockResolvedValueOnce([
                { data: mockDataBuffer1 } as AccountInfo<Buffer>,
                { data: mockDataBuffer2 } as AccountInfo<Buffer>,
            ]);

            const data = await storageAdapter.getMultipleAccounts([address1, address2]);
            expect(data).toEqual([mockDataBuffer1, mockDataBuffer2]);
            expect(mockGetMultipleAccountsInfo).toHaveBeenCalledWith([address1, address2]);
        });

        test('should return null for accounts that do not exist or have no data', async () => {
            const address1 = new PublicKey('MltAcc333333333333333333333333333333333333');
            mockGetMultipleAccountsInfo.mockResolvedValueOnce([null, { data: null } as unknown as AccountInfo<Buffer>]);
            const data = await storageAdapter.getMultipleAccounts([address1, address1]); 
            expect(data).toEqual([null, null]);
        });

        test('should return array of nulls and log error on fetch failure', async () => {
            const address1 = new PublicKey('MltAcc444444444444444444444444444444444444');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGetMultipleAccountsInfo.mockRejectedValueOnce(new Error('Fetch failed'));

            const data = await storageAdapter.getMultipleAccounts([address1]);
            expect(data).toEqual([null]);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching multiple accounts from SolanaStorageAdapter:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    describe('sendTransaction', () => {
        test('should send and confirm a transaction', async () => {
            const transaction = new Transaction(); 
            const mockSignature = 'mocksig1111111111111111111111111111111111111111111111111111111111111';
            mockSendTransaction.mockResolvedValueOnce(mockSignature);
            mockConfirmTransaction.mockResolvedValueOnce({} as any); 

            const signature = await storageAdapter.sendTransaction(transaction);
            expect(signature).toBe(mockSignature);
            expect(mockSendTransaction).toHaveBeenCalledWith(transaction, expect.any(Array)); 
            expect(mockConfirmTransaction).toHaveBeenCalledWith(mockSignature, 'confirmed'); 
        });

        test('should throw error and log on send/confirm failure', async () => {
            const transaction = new Transaction();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockSendTransaction.mockRejectedValueOnce(new Error('Send failed'));

            await expect(storageAdapter.sendTransaction(transaction)).rejects.toThrow('Send failed');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending transaction from SolanaStorageAdapter:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    // New tests for createEntity, getEntityDataById, setEntityDataById, deleteEntityById
    describe('createEntity', () => {
        const entityData = Buffer.from('test data');
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        const mockWorldPDA = new PublicKey('WorldPDA11111111111111111111111111111111111');

        beforeEach(() => {
            mockFindProgramAddressSync.mockReturnValueOnce([mockWorldPDA, 0]);
        });

        test('should create an entity successfully', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log');
            const signature = await storageAdapter.createEntity(entityData, payer, worldName);

            expect(mockFindProgramAddressSync).toHaveBeenCalledWith([
                Buffer.from("world"),
                Buffer.from(worldName),
            ],
            programId);
            expect(mockGetMinimumBalanceForRentExemption).toHaveBeenCalledWith(entityData.length);
            expect(signature).toBe('mocksigCreateEntity11111111111111111111111111111111111111111111');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Entity created successfully'));
            consoleLogSpy.mockRestore();
        });

        test('should throw and log error on failure', async () => {
            jest.spyOn(require('@solana/web3.js'), 'sendAndConfirmTransaction').mockImplementationOnce(() => {
                throw new Error('Create failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(storageAdapter.createEntity(entityData, payer, worldName)).rejects.toThrow('Failed to create entity: Create failed');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.createEntity:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    describe('getEntityDataById', () => {
        const entityId = 'testEntity123';
        const worldName = 'testWorld';
        const mockEntityPDA = new PublicKey('EntityPDA1111111111111111111111111111111111');

        beforeEach(() => {
            mockFindProgramAddressSync.mockReturnValueOnce([mockEntityPDA, 0]);
        });

        test('should get entity data successfully', async () => {
            const mockData = Buffer.from('entity account data');
            mockGetAccountInfo.mockResolvedValueOnce({ data: mockData } as AccountInfo<Buffer>);
            
            const data = await storageAdapter.getEntityDataById(entityId, worldName);

            expect(mockFindProgramAddressSync).toHaveBeenCalledWith([
                Buffer.from("entity"),
                Buffer.from(worldName),
                Buffer.from(entityId),
            ],
            programId);
            expect(mockGetAccountInfo).toHaveBeenCalledWith(mockEntityPDA);
            expect(data).toEqual(mockData);
        });

        test('should return null if entity not found', async () => {
            mockGetAccountInfo.mockResolvedValueOnce(null);
            const data = await storageAdapter.getEntityDataById(entityId, worldName);
            expect(data).toBeNull();
        });

        test('should return null and log error on failure', async () => {
            mockGetAccountInfo.mockRejectedValueOnce(new Error('Get failed'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const data = await storageAdapter.getEntityDataById(entityId, worldName);
            expect(data).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching data from SolanaStorageAdapter:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    describe('setEntityDataById', () => {
        const entityId = 'testEntity123';
        const newData = Buffer.from('updated data');
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        const mockEntityPDA = new PublicKey('SetEntityPDA1111111111111111111111111111111');

        beforeEach(() => {
            mockFindProgramAddressSync.mockReturnValueOnce([mockEntityPDA, 0]);
        });

        test('should set entity data successfully', async () => {
            const signature = await storageAdapter.setEntityDataById(entityId, newData, payer, worldName);

            expect(mockFindProgramAddressSync).toHaveBeenCalledWith([
                Buffer.from("entity"),
                Buffer.from(worldName),
                Buffer.from(entityId),
            ],
            programId);
            expect(signature).toBe('mocksigCreateEntity11111111111111111111111111111111111111111111');
        });

        test('should throw and log error on failure', async () => {
            jest.spyOn(require('@solana/web3.js'), 'sendAndConfirmTransaction').mockImplementationOnce(() => {
                throw new Error('Set failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(storageAdapter.setEntityDataById(entityId, newData, payer, worldName)).rejects.toThrow('Failed to set entity data: Set failed');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.setEntityDataById for entityId "testEntity123":', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    describe('deleteEntityById', () => {
        const entityId = 'testEntity123';
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        const mockEntityPDA = new PublicKey('DelEntityPDA1111111111111111111111111111111');

        beforeEach(() => {
            mockFindProgramAddressSync.mockReturnValueOnce([mockEntityPDA, 0]);
        });

        test('should delete entity successfully', async () => {
            const signature = await storageAdapter.deleteEntityById(entityId, payer, worldName);

            expect(mockFindProgramAddressSync).toHaveBeenCalledWith([
                Buffer.from("entity"),
                Buffer.from(worldName),
                Buffer.from(entityId),
            ],
            programId);
            expect(signature).toBe('mocksigCreateEntity11111111111111111111111111111111111111111111');
        });

        test('should throw and log error on failure', async () => {
            jest.spyOn(require('@solana/web3.js'), 'sendAndConfirmTransaction').mockImplementationOnce(() => {
                throw new Error('Delete failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(storageAdapter.deleteEntityById(entityId, payer, worldName)).rejects.toThrow('Failed to delete entity: Delete failed');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.deleteEntityById for entityId "testEntity123":', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    test('createEntity should handle errors gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockSendAndConfirmTransaction.mockRejectedValue(new Error('Create failed'));
        const mockKeypairForCreate = { _keypair: Buffer.from('testPayer', 'utf8') as any, publicKey: new PublicKey('testPayerPubkey'), secretKey: Buffer.from('testSecret', 'utf8') as any };
        await expect(storageAdapter.createEntity(Buffer.from('testEntity123', 'utf8'), mockKeypairForCreate as any, 'testWorld')).rejects.toThrow('Failed to create entity: undefined is not iterable');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.createEntity:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('getEntityDataById should return null on error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockGetAccountInfo.mockRejectedValue(new Error('Get failed'));
        const result = await storageAdapter.getEntityDataById('testEntity123', 'testWorld');
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.getEntityDataById for entityId "testEntity123":', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('setEntityDataById should handle errors gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockSendAndConfirmTransaction.mockRejectedValue(new Error('Set failed'));
        const mockKeypairForSet = { _keypair: Buffer.from('testPayer', 'utf8') as any, publicKey: new PublicKey('testPayerPubkey'), secretKey: Buffer.from('testSecret', 'utf8') as any };
        await expect(storageAdapter.setEntityDataById('testEntity123', Buffer.from('testEntity123', 'utf8'), mockKeypairForSet as any, 'testWorld')).rejects.toThrow('Failed to set entity data: undefined is not iterable (cannot read property Symbol(Symbol.iterator))');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.setEntityDataById for entityId "testEntity123":', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('deleteEntityById should handle errors gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockSendAndConfirmTransaction.mockRejectedValue(new Error('Delete failed'));
        const mockKeypairForDelete = { _keypair: Buffer.from('testEntity123', 'utf8') as any, publicKey: new PublicKey('testEntity123'), secretKey: Buffer.from('testSecret', 'utf8') as any };
        await expect(storageAdapter.deleteEntityById('testEntity123', mockKeypairForDelete as any, 'testWorld')).rejects.toThrow('Failed to delete entity: undefined is not iterable (cannot read property Symbol(Symbol.iterator))');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.deleteEntityById for entityId "testEntity123":', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });
}); 