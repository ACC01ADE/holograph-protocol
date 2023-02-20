declare var global: any;
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DeployFunction, DeployOptions } from '@holographxyz/hardhat-deploy-holographed/types';
import {
  hreSplit,
  txParams,
  genesisDeployHelper,
  generateInitCode,
  genesisDeriveFutureAddress,
} from '../scripts/utils/helpers';
import { SuperColdStorageSigner } from 'super-cold-storage-signer';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const accounts = await hre.ethers.getSigners();
  let deployer: SignerWithAddress | SuperColdStorageSigner = accounts[0];
  if (global.__superColdStorage) {
    // address, domain, authorization, ca
    const coldStorage = global.__superColdStorage;
    deployer = new SuperColdStorageSigner(
      coldStorage.address,
      'https://' + coldStorage.domain,
      coldStorage.authorization,
      deployer.provider,
      coldStorage.ca
    );
  }

  // Salt is used for deterministic address generation
  const salt = hre.deploymentSalt;

  // Fee manager
  // Fee is 5%
  const feeBPS = 500;
  const futureFeeManagerAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographFeeManager',
    generateInitCode(['uint256', 'address'], [feeBPS, deployer.address]) // initCode
  );
  hre.deployments.log('the future "HolographFeeManager" address is', futureFeeManagerAddress);
  let feeManagerDeployedCode: string = await hre.provider.send('eth_getCode', [futureFeeManagerAddress, 'latest']);

  if (feeManagerDeployedCode == '0x' || feeManagerDeployedCode == '') {
    await genesisDeployHelper(
      hre,
      salt,
      'HolographFeeManager',
      generateInitCode(['uint256', 'address'], [feeBPS, deployer.address]), // initCode
      futureFeeManagerAddress
    );
  } else {
    hre.deployments.log('"EditionMetadataRenderer" is already deployed.');
  }

  // Metadata renderer
  const futureEditionMetadataRendererAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'EditionMetadataRenderer',
    generateInitCode([], []) // initCode
  );
  hre.deployments.log('the future "EditionMetadataRenderer" address is', futureEditionMetadataRendererAddress);
  let editionMetadataRendererDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureEditionMetadataRendererAddress,
    'latest',
  ]);

  if (editionMetadataRendererDeployedCode == '0x' || editionMetadataRendererDeployedCode == '') {
    await genesisDeployHelper(
      hre,
      salt,
      'EditionMetadataRenderer',
      generateInitCode([], []), // initCode
      futureEditionMetadataRendererAddress
    );
  } else {
    hre.deployments.log('"EditionMetadataRenderer" is already deployed.');
  }

  // Deploy the ERC721 drop enforcer
  const futureErc721DropAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographERC721Drop',
    generateInitCode(
      ['tuple(address,address,address,string,string,address,address,uint64,uint16,bytes[],address,bytes)', 'bool'],
      [
        [
          futureFeeManagerAddress, // holographFeeManager
          '0x0000000000000000000000000000000000000000', // holographERC721TransferHelper
          '0x000000000000AAeB6D7670E522A718067333cd4E', // marketFilterAddress (opensea)
          'Holograph ERC721 Drop Collection', // contractName
          'hDROP', // contractSymbol
          deployer.address, // initialOwner
          deployer.address, // fundsRecipient
          1000, // 1000 editions
          1000, // 10% royalty
          [], // setupCalls
          futureEditionMetadataRendererAddress, // metadataRenderer
          generateInitCode(['string', 'string', 'string'], ['decscription', 'imageURI', 'animationURI']), // metadataRendererInit
        ],
        true, // skipInit
      ]
    ) // initCode
  );
  hre.deployments.log('the future "HolographERC721Drop" address is', futureErc721DropAddress);
  let erc721DeployedCode: string = await hre.provider.send('eth_getCode', [futureErc721DropAddress, 'latest']);

  if (erc721DeployedCode == '0x' || erc721DeployedCode == '') {
    hre.deployments.log('"HolographERC721Drop" bytecode not found, need to deploy"');
    let holographErc721Drop = await genesisDeployHelper(
      hre,
      salt,
      'HolographERC721Drop',
      generateInitCode(
        ['tuple(address,address,address,string,string,address,address,uint64,uint16,bytes[],address,bytes)', 'bool'],
        [
          [
            futureFeeManagerAddress, // holographFeeManager
            '0x0000000000000000000000000000000000000000', // holographERC721TransferHelper
            '0x000000000000AAeB6D7670E522A718067333cd4E', // marketFilterAddress
            'Holograph ERC721 Drop Collection', // contractName
            'hDROP', // contractSymbol
            deployer.address, // initialOwner
            deployer.address, // fundsRecipient
            1000, // 1000 editions
            1000, // 10% royalty
            [], // setupCalls
            futureEditionMetadataRendererAddress, // metadataRenderer
            generateInitCode(['string', 'string', 'string'], ['decscription', 'imageURI', 'animationURI']), // metadataRendererInit
          ],
          true, // skipInit
        ]
      ), // initCode
      futureErc721DropAddress
    );
  } else {
    hre.deployments.log('"HolographERC721Drop" is already deployed.');
  }
};

export default func;
func.tags = ['HolographERC721Drop', 'DeployERC721Drop'];
func.dependencies = ['HolographGenesis', 'DeploySources'];
