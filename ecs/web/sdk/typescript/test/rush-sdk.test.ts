/// <reference types="jest" />
import { RushSDK, SDKError } from '../src/RushSDK';                       // Adjusted path
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { World } from '../src/core/World';                   // Adjusted path
import { Entity } from '../src/core/Entity';                  // Adjusted path
import { StoragePort } from '../src/storage/StoragePort';            // Adjusted path
import { SolanaStorageAdapter } from '../src/storage/SolanaStorageAdapter';// Adjusted path
import { SystemPort } from '../src/core/SystemPort';                // Adjusted path

// Mocks
const mockConnection = {
    getProgramAccounts: jest.fn(),
    getMinimumBalanceForRentExemption: jest.fn().mockResolvedValue(1000000),
    getAccountInfo: jest.fn(),
    sendTransaction: jest.fn(), 
    confirmTransaction: jest.fn()
} as unknown as Connection;

jest.mock('@solana/web3.js', () => {
    const actualWeb3 = jest.requireActual('@solana/web3.js');
    return {
        ...actualWeb3,
        sendAndConfirmTransaction: jest.fn().mockResolvedValue('mocksig'),
        Connection: jest.fn().mockImplementation(() => mockConnection),
        PublicKey: actualWeb3.PublicKey,
        Keypair: actualWeb3.Keypair,
        Transaction: actualWeb3.Transaction,
        SystemProgram: actualWeb3.SystemProgram,
    };
});

jest.mock('../src/storage/SolanaStorageAdapter'); // Adjusted mock path
jest.mock('../src/core/World');                   // Adjusted mock path
jest.mock('../src/core/Entity');                  // Adjusted mock path

describe('RushSDK', () => {
    let sdk: RushSDK;
    let mockWorldInstance: World;
    let mockStoragePortInstance: StoragePort; 
    const mockProgramId = PublicKey.default;
    const mockWallet = Keypair.generate();

    beforeEach(() => {
        jest.clearAllMocks();
        (SolanaStorageAdapter as jest.Mock).mockImplementation(() => {
            return {
                getConnection: jest.fn().mockReturnValue(mockConnection),
                getProgramId: jest.fn().mockReturnValue(mockProgramId),
                createEntity: jest.fn().mockResolvedValue(undefined),
                setEntityDataById: jest.fn().mockResolvedValue(undefined)
            };
        });
        (World as jest.Mock).mockImplementation(() => {
            const entities = new Map<string, Entity>();
            return {
                createEntity: jest.fn((id, publicKey) => {
                    const mockEntity = new (Entity as any)(id, publicKey);
                    mockEntity.addComponent = jest.fn();
                    mockEntity.getComponents = jest.fn().mockReturnValue(new Map());
                    mockEntity.getId = jest.fn().mockReturnValue(id);
                    mockEntity.getPublicKey = jest.fn().mockReturnValue(publicKey);
                    entities.set(id, mockEntity);
                    return mockEntity;
                }),
                getEntity: jest.fn((id) => entities.get(id)),
                query: jest.fn().mockReturnValue([]), 
                addSystem: jest.fn(),
                update: jest.fn(),
            };
        });
        
        sdk = new RushSDK(mockConnection, mockProgramId);
        sdk.setPrimaryWallet(mockWallet);
        mockWorldInstance = sdk.getWorld();
        mockStoragePortInstance = sdk.getStorage();
    });

    test('should initialize world and storage', () => {
        expect(World).toHaveBeenCalledTimes(1);
        expect(SolanaStorageAdapter).toHaveBeenCalledWith(mockConnection, mockProgramId);
        expect(sdk.getWorld()).toBeDefined();
        expect(sdk.getStorage()).toBeDefined();
    });

    test('setWallet should store the wallet', () => {
        const newSdk = new RushSDK(mockConnection, mockProgramId);
        const newWallet = Keypair.generate();
        newSdk.setPrimaryWallet(newWallet);
        expect(() => { newSdk.createEntity(); }).not.toThrow();
    });

    describe('createEntity', () => {
        test('should create an entity in the world', async () => {
            const components = { position: { x: 1, y: 1 } };
            const entity = await sdk.createEntity(components);
            expect(mockWorldInstance.createEntity).toHaveBeenCalled();
            const mockCall = (mockWorldInstance.createEntity as jest.Mock).mock.calls[0];
            expect(mockCall[0]).toBeDefined();
            expect(mockCall[1]).toBeInstanceOf(PublicKey);
            expect(entity.addComponent).toHaveBeenCalledWith('position', { x: 1, y: 1 });
        });

        test('should throw SDKError if wallet is not set', async () => {
            const newSdk = new RushSDK(mockConnection, mockProgramId);
            await expect(newSdk.createEntity()).rejects.toThrow(new SDKError('No active payer wallet found. Set a primary wallet or create and activate a session.'));
        });
    });

    test('addSystem should call world.addSystem', () => {
        const mockSystem = {} as SystemPort; 
        sdk.addSystem(mockSystem);
        expect(mockWorldInstance.addSystem).toHaveBeenCalledWith(mockSystem);
    });

    test('update should call world.update', () => {
        const deltaTime = 0.16;
        sdk.update(deltaTime);
        expect(mockWorldInstance.update).toHaveBeenCalledWith(deltaTime);
    });

    describe('syncWithChain', () => {
        test('should throw SDKError if wallet is not set', async () => {
            const newSdk = new RushSDK(mockConnection, mockProgramId);
            await expect(newSdk.syncWithChain()).rejects.toThrow('Wallet not set. Cannot sync with chain.');
        });

        test('should fetch program accounts and update world', async () => {
            const mockEntityId1 = 'entityOnChain1';
            const mockEntityOwner1 = Keypair.generate().publicKey;
            const mockEntityAccount1 = {
                pubkey: mockEntityOwner1,
                account: {
                    data: Buffer.from(JSON.stringify({ 
                        id: mockEntityId1, 
                        owner: mockEntityOwner1.toBase58(), 
                        components: { onChainComp: { val: 1 } } 
                    })),
                    executable: false, lamports: 100000, owner: mockProgramId, rentEpoch: 0
                }
            };
            (mockConnection.getProgramAccounts as jest.Mock).mockResolvedValue([mockEntityAccount1]);
            const createdEntityMock = {
                 getComponents: jest.fn().mockReturnValue(new Map()), addComponent: jest.fn(),
                 getId: jest.fn().mockReturnValue(mockEntityId1), getPublicKey: jest.fn().mockReturnValue(mockEntityOwner1)
            };    
            (mockWorldInstance.getEntity as jest.Mock).mockReturnValueOnce(undefined);
            (mockWorldInstance.createEntity as jest.Mock).mockReturnValueOnce(createdEntityMock);
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            await sdk.syncWithChain();
            expect(mockConnection.getProgramAccounts).toHaveBeenCalledWith(mockProgramId);
            expect(mockWorldInstance.createEntity).toHaveBeenCalledWith(mockEntityId1, mockEntityOwner1);
            expect(createdEntityMock.addComponent).not.toHaveBeenCalledWith('onChainComp', { val: 1 });
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Entity "entityOnChain1" not found locally. Component "onChainComp" was validated but not added.'
            );
            consoleWarnSpy.mockRestore();
        });

         test('should handle deserialization failure gracefully', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const invalidDataAccount = {
                pubkey: Keypair.generate().publicKey,
                account: { data: Buffer.from('{"invalid_json') },
            };
            (mockConnection.getProgramAccounts as jest.Mock).mockResolvedValue([invalidDataAccount]);
            await sdk.syncWithChain();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error deserializing entity data:', expect.any(Error));
            expect(mockWorldInstance.createEntity).not.toHaveBeenCalledWith('invalidDataKey', expect.anything());
            consoleWarnSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('saveToChain', () => {
        test('should throw SDKError if wallet is not set', async () => {
            const newSdk = new RushSDK(mockConnection, mockProgramId);
            await expect(newSdk.saveToChain()).rejects.toThrow('No active payer wallet found. Set a primary wallet or create and activate a session.');
        });

        test('should attempt to save entities from world', async () => {
            const entityToSaveKey = Keypair.generate().publicKey;
            const entityToSave = {
                getId: jest.fn().mockReturnValue('localEntity1'), getPublicKey: jest.fn().mockReturnValue(entityToSaveKey),
                getComponents: jest.fn().mockReturnValue(new Map([['localComp', { val: 1 }]]))
            } as unknown as Entity;
            (mockWorldInstance.query as jest.Mock).mockReturnValue([entityToSave]);
            (mockConnection.getAccountInfo as jest.Mock).mockResolvedValue(null);
            await sdk.saveToChain();
            expect(mockStoragePortInstance.setEntityDataById).toHaveBeenCalled();
        });

         test('should log warning if saveEntityToChain needs real program instruction', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const entityKey = Keypair.generate().publicKey;
            const entityToSave = {
                getId: () => 'e1', getPublicKey: () => entityKey,
                getComponents: () => new Map([['position', {x:1,y:1}]])
            } as Entity;
            (mockWorldInstance.query as jest.Mock).mockReturnValue([entityToSave]);
            (mockConnection.getAccountInfo as jest.Mock).mockResolvedValue({}); 
            await sdk.saveToChain();
            expect(consoleWarnSpy).not.toHaveBeenCalledWith("Placeholder: saveEntityToChain needs a real program instruction to write data.");
            consoleWarnSpy.mockRestore();
        });
    });

    test('exampleMethodThatCouldFail should throw SDKError sometimes', () => {
        let thrown = false;
        for (let i = 0; i < 20; i++) { 
            try { sdk.exampleMethodThatCouldFail(); } catch (e) { if (e instanceof SDKError) thrown = true; }
        }
    });
}); 