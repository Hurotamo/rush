/// <reference types="jest" />
// Define mocks before jest.mock uses them
const mockFindProgramAddressSync = jest.fn();
const mockSendAndConfirmTransaction = jest.fn();

import { Connection, PublicKey, Transaction, Keypair, AccountInfo, SystemProgram, TransactionInstruction, sendAndConfirmTransaction as originalSendAndConfirmTransaction } from '@solana/web3.js';
import { SolanaStorageAdapter, SolanaStorageError } from '../src/storage/SolanaStorageAdapter'; // Adjusted path
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
    let callCount = 0;
    mockSendTransaction.mockReset().mockImplementation((transaction, signers) => {
        callCount++;
        // Use call count or transaction details to determine the operation
        if (transaction.instructions.length > 1) {
            // Assuming createEntity has more than one instruction (create account + set data)
            return Promise.resolve('mocksigCreateEntity11111111111111111111111111111111111111111111');
        } else if (transaction.instructions.some((instr: TransactionInstruction) => instr.data && instr.data.length > 0 && instr.data.toString().includes('updated'))) {
            return Promise.resolve('mocksigSetEntity11111111111111111111111111111111111111111111');
        } else {
            return Promise.resolve('mocksigDeleteEntity111111111111111111111111111111111111111111');
        }
    });
    mockConfirmTransaction.mockReset().mockImplementation(() => Promise.resolve({}));
    mockGetMinimumBalanceForRentExemption.mockResolvedValue(1000000);
    mockFindProgramAddressSync.mockReset().mockImplementation((seeds, programId) => {
        // Return a mock PublicKey and bump
        return [new PublicKey('MockPDA11111111111111111111111111111111111'), 255];
    });
    mockSendAndConfirmTransaction.mockReset().mockImplementation((connection, transaction, signers) => {
        // Return different signatures based on the context of the transaction
        if (transaction.instructions.length > 1) {
            return Promise.resolve('mocksigCreateEntity11111111111111111111111111111111111111111111');
        } else if (transaction.instructions.some((instr: TransactionInstruction) => instr.data && instr.data.length > 0 && instr.data.toString().includes('updated'))) {
            return Promise.resolve('mocksigSetEntity11111111111111111111111111111111111111111111');
        } else if (transaction.instructions.some((instr: TransactionInstruction) => instr.data && instr.data.length === 1)) {
            // Assuming migrate has a single instruction with a single byte of data (bump)
            return Promise.resolve('mocksigMigrate11111111111111111111111111111111111111111111');
        } else {
            return Promise.resolve('mocksigDeleteEntity111111111111111111111111111111111111111111');
        }
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
    let adapter: SolanaStorageAdapter;
    let connection: Connection;
    let programId: PublicKey;
    let payer: Keypair;

    beforeAll(() => {
        connection = mockConnection;
        programId = new PublicKey('8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt');
        adapter = new SolanaStorageAdapter(connection, programId);
        payer = Keypair.generate();
    });

    test('Constructor should initialize with Sonic Devnet settings', () => {
        // Skip type checking for mocked connection
        expect(adapter.getConnection()).toBeDefined();
        // Skip strict type checking for mocked PublicKey
        expect(adapter.getProgramId()).toBeDefined();
        expect(adapter.getProgramId().toBase58()).toBe('8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt');
    });

    test('Constructor should accept URL string and program ID string', () => {
        const urlAdapter = new SolanaStorageAdapter('https://api.sonic.game/devnet', '8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt');
        expect(urlAdapter.getConnection()).toBeDefined();
        expect(urlAdapter.getProgramId()).toBeDefined();
        expect(urlAdapter.getProgramId().toBase58()).toBe('8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt');
    });

    test('Migrate should create or update world', async () => {
        const signature = await adapter.migrate('test_world', payer);
        expect(signature).toBeDefined();
        expect(typeof signature).toBe('string');
    });

    test('Create should create a new entity', async () => {
        const entityData = Buffer.from(JSON.stringify({ id: 'test_entity', type: 'player' }));
        const signature = await adapter.createEntity(entityData, payer, 'test_world');
        expect(signature).toBeDefined();
        expect(typeof signature).toBe('string');
    });

    test('Get should retrieve entity data', async () => {
        const mockData = Buffer.from(JSON.stringify({ id: 'test_entity', type: 'player' }));
        (mockConnection.getAccountInfo as jest.Mock).mockResolvedValue({ data: mockData });
        const data = await adapter.getEntityDataById('test_entity', 'test_world');
        expect(data).toBeDefined();
        expect(data).toEqual(mockData);
    });

    test('Set should update entity data', async () => {
        const newData = Buffer.from(JSON.stringify({ id: 'test_entity', type: 'updated_player' }));
        const signature = await adapter.setEntityDataById('test_entity', newData, payer, 'test_world');
        expect(signature).toBeDefined();
        expect(typeof signature).toBe('string');
    });

    test('Delete should remove entity', async () => {
        const signature = await adapter.deleteEntityById('test_entity', payer, 'test_world');
        expect(signature).toBeDefined();
        expect(typeof signature).toBe('string');
    });

    test('should get programId', () => {
        expect(adapter.getProgramId()).toBeDefined();
    });

    test('should get connection', () => {
        expect(adapter.getConnection()).toBeDefined();
    });

    describe('getData', () => {
        test('should fetch and return account data', async () => {
            const address = new PublicKey('Acc111111111111111111111111111111111111111');
            const mockDataBuffer = Buffer.from('mock account data');
            mockGetAccountInfo.mockResolvedValueOnce({ data: mockDataBuffer } as AccountInfo<Buffer>);

            const data = await adapter.getData(address);
            expect(data).toEqual(mockDataBuffer);
            expect(mockGetAccountInfo).toHaveBeenCalledWith(address);
        });

        test('should throw SolanaStorageError if account does not exist or has no data', async () => {
            const address = new PublicKey('Acc222222222222222222222222222222222222222');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGetAccountInfo.mockResolvedValueOnce(null);
            await expect(adapter.getData(address)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.getData(address)).rejects.toHaveProperty('code', 'DATA_FETCH_ERROR');

            mockGetAccountInfo.mockResolvedValueOnce({ data: null } as unknown as AccountInfo<Buffer>); 
            await expect(adapter.getData(address)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.getData(address)).rejects.toHaveProperty('code', 'DATA_FETCH_ERROR');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching data from SolanaStorageAdapter:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        test('should throw SolanaStorageError and log error on fetch failure', async () => {
            const address = new PublicKey('Acc333333333333333333333333333333333333333');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGetAccountInfo.mockRejectedValueOnce(new Error('Fetch failed'));
            await expect(adapter.getData(address)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.getData(address)).rejects.toHaveProperty('code', 'DATA_FETCH_ERROR');
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

            const data = await adapter.getMultipleAccounts([address1, address2]);
            expect(data).toEqual([mockDataBuffer1, mockDataBuffer2]);
            expect(mockGetMultipleAccountsInfo).toHaveBeenCalledWith([address1, address2]);
        });

        test('should throw SolanaStorageError for accounts that do not exist or have no data', async () => {
            const address1 = new PublicKey('MltAcc333333333333333333333333333333333333');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGetMultipleAccountsInfo.mockResolvedValueOnce([null, { data: null } as unknown as AccountInfo<Buffer>]);
            await expect(adapter.getMultipleAccounts([address1, address1])).rejects.toThrow(SolanaStorageError);
            await expect(adapter.getMultipleAccounts([address1, address1])).rejects.toHaveProperty('code', 'MULTIPLE_ACCOUNTS_FETCH_ERROR');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching multiple accounts from SolanaStorageAdapter:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        test('should throw SolanaStorageError and log error on fetch failure', async () => {
            const address1 = new PublicKey('MltAcc444444444444444444444444444444444444');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGetMultipleAccountsInfo.mockRejectedValueOnce(new Error('Fetch failed'));
            await expect(adapter.getMultipleAccounts([address1])).rejects.toThrow(SolanaStorageError);
            await expect(adapter.getMultipleAccounts([address1])).rejects.toHaveProperty('code', 'MULTIPLE_ACCOUNTS_FETCH_ERROR');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching multiple accounts from SolanaStorageAdapter:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    describe('sendTransaction', () => {
        test('should send and confirm a transaction', async () => {
            const transaction = new Transaction();
            const mockSignature = 'mocksig1111111111111111111111111111111111111111111111111111111111111';
            mockSendTransaction.mockResolvedValueOnce(mockSignature);
            mockConfirmTransaction.mockResolvedValueOnce({});

            const signature = await adapter.sendTransaction(transaction);

            expect(signature).toBe(mockSignature);
            expect(mockSendTransaction).toHaveBeenCalledWith(transaction, expect.any(Array)); 
            expect(mockConfirmTransaction).toHaveBeenCalledWith(mockSignature, 'confirmed'); 
        });

        test('should throw SolanaStorageError and log on send/confirm failure', async () => {
            const transaction = new Transaction();
            mockSendTransaction.mockReset();
            mockSendTransaction.mockRejectedValue(new Error('Send failed'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(adapter.sendTransaction(transaction)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.sendTransaction(transaction)).rejects.toHaveProperty('code', 'TRANSACTION_SEND_ERROR');
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
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const signature = await adapter.createEntity(entityData, payer, worldName);

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

        test('should throw SolanaStorageError and log error on failure', async () => {
            mockSendTransaction.mockReset().mockImplementation((transaction, signers) => {
                throw new Error('Create failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(adapter.createEntity(entityData, payer, worldName)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.createEntity(entityData, payer, worldName)).rejects.toHaveProperty('code', 'ENTITY_CREATE_ERROR');
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
            mockGetAccountInfo.mockReset();
            // Default mock for successful retrieval
            const mockData = Buffer.from('entity account data');
            mockGetAccountInfo.mockResolvedValue({ data: mockData } as AccountInfo<Buffer>);
        });

        test('should get entity data successfully', async () => {
            const data = await adapter.getEntityDataById(entityId, worldName);

            expect(mockFindProgramAddressSync).toHaveBeenCalledWith([
                Buffer.from("entity"),
                Buffer.from(worldName),
                Buffer.from(entityId),
            ],
            programId);
            expect(mockGetAccountInfo).toHaveBeenCalledWith(mockEntityPDA);
            expect(data).toEqual(Buffer.from('entity account data'));
        });

        test('should throw SolanaStorageError if entity not found', async () => {
            // Override mock for this test to simulate entity not found
            mockGetAccountInfo.mockReset();
            mockGetAccountInfo.mockResolvedValue(null);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(adapter.getEntityDataById(entityId, worldName)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.getEntityDataById(entityId, worldName)).rejects.toHaveProperty('code', 'ENTITY_GET_ERROR');
            expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.getEntityDataById for entityId "${entityId}":`, expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        test('should throw SolanaStorageError and log error on failure', async () => {
            // Override mock for this test to simulate fetch error
            mockGetAccountInfo.mockReset();
            mockGetAccountInfo.mockRejectedValue(new Error('Get failed'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(adapter.getEntityDataById(entityId, worldName)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.getEntityDataById(entityId, worldName)).rejects.toHaveProperty('code', 'ENTITY_GET_ERROR');
            expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.getEntityDataById for entityId "${entityId}":`, expect.any(Error));
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
            const signature = await adapter.setEntityDataById(entityId, newData, payer, worldName);

            expect(mockFindProgramAddressSync).toHaveBeenCalledWith([
                Buffer.from("entity"),
                Buffer.from(worldName),
                Buffer.from(entityId),
            ],
            programId);
            expect(signature).toBe('mocksigSetEntity11111111111111111111111111111111111111111111');
        });

        test('should throw SolanaStorageError and log error on failure', async () => {
            mockSendTransaction.mockReset().mockImplementation((transaction, signers) => {
                throw new Error('Set failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(adapter.setEntityDataById(entityId, newData, payer, worldName)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.setEntityDataById(entityId, newData, payer, worldName)).rejects.toHaveProperty('code', 'ENTITY_SET_ERROR');
            expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.setEntityDataById for entityId "${entityId}":`, expect.any(Error));
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
            const signature = await adapter.deleteEntityById(entityId, payer, worldName);

            expect(mockFindProgramAddressSync).toHaveBeenCalledWith([
                Buffer.from("entity"),
                Buffer.from(worldName),
                Buffer.from(entityId),
            ],
            programId);
            expect(signature).toBe('mocksigDeleteEntity111111111111111111111111111111111111111111');
        });

        test('should throw SolanaStorageError and log error on failure', async () => {
            mockSendTransaction.mockReset().mockImplementation((transaction, signers) => {
                throw new Error('Delete failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(adapter.deleteEntityById(entityId, payer, worldName)).rejects.toThrow(SolanaStorageError);
            await expect(adapter.deleteEntityById(entityId, payer, worldName)).rejects.toHaveProperty('code', 'ENTITY_DELETE_ERROR');
            expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.deleteEntityById for entityId "${entityId}":`, expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    test('createEntity should handle errors gracefully', async () => {
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockKeypairForCreate = { _keypair: Buffer.from('testPayer', 'utf8') as any, publicKey: new PublicKey('testPayerPubkey'), secretKey: Buffer.from('testSecret', 'utf8') as any };
        await expect(adapter.createEntity(Buffer.from('testEntity123', 'utf8'), mockKeypairForCreate as any, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.createEntity(Buffer.from('testEntity123', 'utf8'), mockKeypairForCreate as any, 'testWorld')).rejects.toHaveProperty('code', 'ENTITY_CREATE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.createEntity:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('getEntityDataById should throw SolanaStorageError on error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockGetAccountInfo.mockRejectedValue(new Error('Get failed'));
        await expect(adapter.getEntityDataById('testEntity123', 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.getEntityDataById('testEntity123', 'testWorld')).rejects.toHaveProperty('code', 'ENTITY_GET_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.getEntityDataById for entityId "testEntity123":', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('setEntityDataById should handle errors gracefully', async () => {
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockKeypairForSet = { _keypair: Buffer.from('testPayer', 'utf8') as any, publicKey: new PublicKey('testPayerPubkey'), secretKey: Buffer.from('testSecret', 'utf8') as any };
        await expect(adapter.setEntityDataById('testEntity123', Buffer.from('testEntity123', 'utf8'), mockKeypairForSet as any, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.setEntityDataById('testEntity123', Buffer.from('testEntity123', 'utf8'), mockKeypairForSet as any, 'testWorld')).rejects.toHaveProperty('code', 'ENTITY_SET_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.setEntityDataById for entityId "testEntity123":', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('deleteEntityById should handle errors gracefully', async () => {
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockKeypairForDelete = { _keypair: Buffer.from('testEntity123', 'utf8') as any, publicKey: new PublicKey('testEntity123'), secretKey: Buffer.from('testSecret', 'utf8') as any };
        await expect(adapter.deleteEntityById('testEntity123', mockKeypairForDelete as any, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.deleteEntityById('testEntity123', mockKeypairForDelete as any, 'testWorld')).rejects.toHaveProperty('code', 'ENTITY_DELETE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.deleteEntityById for entityId "testEntity123":', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('migrate should handle errors gracefully', async () => {
        const tempMock = jest.fn().mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockImplementation(tempMock);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(adapter.migrate('testWorld', payer)).rejects.toThrow(SolanaStorageError);
        await expect(adapter.migrate('testWorld', payer)).rejects.toHaveProperty('code', 'WORLD_MIGRATE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.migrate:', expect.any(Error));
        consoleErrorSpy.mockRestore();
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRestore();
    });

    // Test error handling for sendTransaction throwing an error
    test('sendTransaction should throw SolanaStorageError on failure', async () => {
        mockSendTransaction.mockRejectedValue(new Error('Network error'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(adapter.sendTransaction({} as any)).rejects.toThrow(SolanaStorageError);
        await expect(adapter.sendTransaction({} as any)).rejects.toMatchObject({
            code: 'TRANSACTION_SEND_ERROR',
            message: expect.stringContaining('Transaction failed'),
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending transaction from SolanaStorageAdapter:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    // Test error handling for createEntity
    test('createEntity should throw SolanaStorageError on failure', async () => {
        mockSendAndConfirmTransaction.mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const entityData = Buffer.from(JSON.stringify({ data: 'test' }));
        const payer = Keypair.generate();
        await expect(adapter.createEntity(entityData, payer, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.createEntity(entityData, payer, 'testWorld')).rejects.toMatchObject({
            code: 'ENTITY_CREATE_ERROR',
            message: expect.stringContaining('Failed to create entity'),
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.createEntity:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    // Test error handling for setEntityDataById
    test('setEntityDataById should throw SolanaStorageError on failure', async () => {
        mockSendAndConfirmTransaction.mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const data = Buffer.from(JSON.stringify({ data: 'updated' }));
        const payer = Keypair.generate();
        await expect(adapter.setEntityDataById('testType', data, payer, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.setEntityDataById('testType', data, payer, 'testWorld')).rejects.toMatchObject({
            code: 'ENTITY_SET_ERROR',
            message: expect.stringContaining('Failed to set entity data'),
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.setEntityDataById for entityId "testType":`, expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    // Test error handling for deleteEntityById
    test('deleteEntityById should throw SolanaStorageError on failure', async () => {
        mockSendAndConfirmTransaction.mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const payer = Keypair.generate();
        await expect(adapter.deleteEntityById('testType', payer, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.deleteEntityById('testType', payer, 'testWorld')).rejects.toMatchObject({
            code: 'ENTITY_DELETE_ERROR',
            message: expect.stringContaining('Failed to delete entity'),
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.deleteEntityById for entityId "testType":`, expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    // Test error handling for migrate
    test('migrate should throw SolanaStorageError on failure', async () => {
        const tempMock = jest.fn().mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockImplementation(tempMock);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(adapter.migrate('testWorld', payer)).rejects.toThrow(SolanaStorageError);
        await expect(adapter.migrate('testWorld', payer)).rejects.toHaveProperty('code', 'WORLD_MIGRATE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.migrate:', expect.any(Error));
        consoleErrorSpy.mockRestore();
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRestore();
    });

    // Test getEntityById with entity not found
    test('getEntityDataById should throw SolanaStorageError if entity not found', async () => {
        (mockConnection.getAccountInfo as jest.Mock).mockResolvedValue(null);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(adapter.getEntityDataById('testType', 'nonexistentId')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.getEntityDataById('testType', 'nonexistentId')).rejects.toMatchObject({
            code: 'ENTITY_GET_ERROR',
            message: expect.stringContaining('Failed to get entity data'),
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.getEntityDataById for entityId "testType":`, expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('getEntityDataById should return entity data if found', async () => {
        const mockAccountInfo = {
            data: Buffer.from(JSON.stringify({ data: 'testData' })),
            executable: false,
            owner: new PublicKey('8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt'),
            lamports: 1000,
            rentEpoch: 0,
        };
        (mockConnection.getAccountInfo as jest.Mock).mockResolvedValue(mockAccountInfo);
        const result = await adapter.getEntityDataById('testType', 'testId');
        expect(result).toEqual(Buffer.from(JSON.stringify({ data: 'testData' })));
    });

    // Test for createEntity
    test('createEntity should create an entity successfully', async () => {
        const entityData = Buffer.from(JSON.stringify({ data: 'test' }));
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockResolvedValue('mockSignature');
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const signature = await adapter.createEntity(entityData, payer, worldName);
        expect(signature).toBe('mockSignature');
        expect(mockGetMinimumBalanceForRentExemption).toHaveBeenCalledWith(entityData.length);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Entity created successfully'));
        consoleLogSpy.mockRestore();
    });

    // Test for setEntityDataById
    test('setEntityDataById should set entity data successfully', async () => {
        const entityId = 'testType';
        const data = Buffer.from(JSON.stringify({ data: 'updated' }));
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockResolvedValue('mockSignature');
        const signature = await adapter.setEntityDataById(entityId, data, payer, worldName);
        expect(signature).toBe('mockSignature');
    });

    // Test for deleteEntityById
    test('deleteEntityById should delete entity successfully', async () => {
        const entityId = 'testType';
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockResolvedValue('mockSignature');
        const signature = await adapter.deleteEntityById(entityId, payer, worldName);
        expect(signature).toBe('mockSignature');
    });

    // Test error handling for createEntity
    test('createEntity should throw SolanaStorageError and log error on failure', async () => {
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const entityData = Buffer.from(JSON.stringify({ data: 'test' }));
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        await expect(adapter.createEntity(entityData, payer, worldName)).rejects.toThrow(SolanaStorageError);
        await expect(adapter.createEntity(entityData, payer, worldName)).rejects.toHaveProperty('code', 'ENTITY_CREATE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.createEntity:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    // Test error handling for setEntityDataById
    test('setEntityDataById should throw SolanaStorageError and log error on failure', async () => {
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const entityId = 'testType';
        const newData = Buffer.from(JSON.stringify({ data: 'updated' }));
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        await expect(adapter.setEntityDataById(entityId, newData, payer, worldName)).rejects.toThrow(SolanaStorageError);
        await expect(adapter.setEntityDataById(entityId, newData, payer, worldName)).rejects.toHaveProperty('code', 'ENTITY_SET_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.setEntityDataById for entityId "${entityId}":`, expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    // Test error handling for deleteEntityById
    test('deleteEntityById should throw SolanaStorageError and log error on failure', async () => {
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRejectedValue(new Error('Transaction failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const entityId = 'testType';
        const payer = Keypair.generate();
        const worldName = 'testWorld';
        await expect(adapter.deleteEntityById(entityId, payer, worldName)).rejects.toThrow(SolanaStorageError);
        await expect(adapter.deleteEntityById(entityId, payer, worldName)).rejects.toHaveProperty('code', 'ENTITY_DELETE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.deleteEntityById for entityId "${entityId}":`, expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    // Test error handling for migrate
    test('migrate should throw SolanaStorageError on failure', async () => {
        const tempMock = jest.fn().mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockImplementation(tempMock);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(adapter.migrate('testWorld', payer)).rejects.toThrow(SolanaStorageError);
        await expect(adapter.migrate('testWorld', payer)).rejects.toHaveProperty('code', 'WORLD_MIGRATE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.migrate:', expect.any(Error));
        consoleErrorSpy.mockRestore();
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRestore();
    });
});

// Start of consolidated tests for error handling without overriding primary mocks
describe('Error Handling Tests', () => {
    let adapter: SolanaStorageAdapter;
    let connection: Connection;
    let programId: PublicKey;
    let payer: Keypair;

    beforeEach(() => {
        connection = mockConnection;
        programId = new PublicKey('8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt');
        adapter = new SolanaStorageAdapter(connection, programId);
        payer = Keypair.generate();
    });

    test('createEntity should throw SolanaStorageError on failure', async () => {
        // Temporarily override for this test only without affecting global mock
        const tempMock = jest.fn().mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockImplementation(tempMock);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const entityData = Buffer.from(JSON.stringify({ data: 'test' }));
        await expect(adapter.createEntity(entityData, payer, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.createEntity(entityData, payer, 'testWorld')).rejects.toHaveProperty('code', 'ENTITY_CREATE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.createEntity:', expect.any(Error));
        consoleErrorSpy.mockRestore();
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRestore();
    });

    test('setEntityDataById should throw SolanaStorageError on failure', async () => {
        const tempMock = jest.fn().mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockImplementation(tempMock);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const entityId = 'testType';
        const newData = Buffer.from(JSON.stringify({ data: 'updated' }));
        await expect(adapter.setEntityDataById(entityId, newData, payer, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.setEntityDataById(entityId, newData, payer, 'testWorld')).rejects.toHaveProperty('code', 'ENTITY_SET_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.setEntityDataById for entityId "${entityId}":`, expect.any(Error));
        consoleErrorSpy.mockRestore();
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRestore();
    });

    test('deleteEntityById should throw SolanaStorageError on failure', async () => {
        const tempMock = jest.fn().mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockImplementation(tempMock);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const entityId = 'testType';
        await expect(adapter.deleteEntityById(entityId, payer, 'testWorld')).rejects.toThrow(SolanaStorageError);
        await expect(adapter.deleteEntityById(entityId, payer, 'testWorld')).rejects.toHaveProperty('code', 'ENTITY_DELETE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in SolanaStorageAdapter.deleteEntityById for entityId "${entityId}":`, expect.any(Error));
        consoleErrorSpy.mockRestore();
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRestore();
    });

    test('migrate should throw SolanaStorageError on failure', async () => {
        const tempMock = jest.fn().mockRejectedValue(new Error('Transaction failed'));
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockImplementation(tempMock);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(adapter.migrate('testWorld', payer)).rejects.toThrow(SolanaStorageError);
        await expect(adapter.migrate('testWorld', payer)).rejects.toHaveProperty('code', 'WORLD_MIGRATE_ERROR');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in SolanaStorageAdapter.migrate:', expect.any(Error));
        consoleErrorSpy.mockRestore();
        jest.spyOn(adapter, 'sendAndConfirmTransaction' as any).mockRestore();
    });
}); 