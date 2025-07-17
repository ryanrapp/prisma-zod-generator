import {
  DMMF,
  EnvValue,
  GeneratorConfig,
  GeneratorOptions,
} from '@prisma/generator-helper';
import { getDMMF, parseEnvValue } from '@prisma/internals';
import { promises as fs } from 'fs';
import path from 'path';
import {
  addMissingInputObjectTypes,
  hideInputObjectTypesAndRelatedFields,
  resolveAddMissingInputObjectTypeOptions,
  resolveModelsComments,
} from './helpers';
import { resolveAggregateOperationSupport } from './helpers/aggregate-helpers';
import Transformer from './transformer';
import { AggregateOperationSupport } from './types';
import removeDir from './utils/removeDir';

export async function generate(options: GeneratorOptions) {
  try {
    await handleGeneratorOutputValue(options.generator.output as EnvValue);

    const prismaClientGeneratorConfig = getGeneratorConfigByProvider(
      options.otherGenerators,
      'prisma-client-js',
    );

    const prismaClientDmmf = await getDMMF({
      datamodel: options.datamodel,
      previewFeatures: prismaClientGeneratorConfig?.previewFeatures,
    });

    checkForCustomPrismaClientOutputPath(prismaClientGeneratorConfig);

    const modelOperations = prismaClientDmmf.mappings.modelOperations;
    const inputObjectTypes = prismaClientDmmf.schema.inputObjectTypes.prisma;
    const outputObjectTypes = prismaClientDmmf.schema.outputObjectTypes.prisma;
    const enumTypes = prismaClientDmmf.schema.enumTypes;
    const models: DMMF.Model[] = prismaClientDmmf.datamodel.models;
    const hiddenModels: string[] = [];
    const hiddenFields: string[] = [];
    resolveModelsComments(
      models,
      modelOperations,
      enumTypes,
      hiddenModels,
      hiddenFields,
    );

    await generateEnumSchemas(
      prismaClientDmmf.schema.enumTypes.prisma,
      prismaClientDmmf.schema.enumTypes.model ?? [],
    );

    const dataSource = options.datasources?.[0];
    const previewFeatures = prismaClientGeneratorConfig?.previewFeatures;
    Transformer.provider = dataSource.provider;
    Transformer.previewFeatures = previewFeatures;

    const generatorConfigOptions = options.generator.config;

    const addMissingInputObjectTypeOptions =
      resolveAddMissingInputObjectTypeOptions(generatorConfigOptions);
    addMissingInputObjectTypes(
      inputObjectTypes,
      outputObjectTypes,
      models,
      modelOperations,
      dataSource.provider,
      addMissingInputObjectTypeOptions,
    );

    const aggregateOperationSupport =
      resolveAggregateOperationSupport(inputObjectTypes);

    hideInputObjectTypesAndRelatedFields(
      inputObjectTypes,
      hiddenModels,
      hiddenFields,
    );

    await generateObjectSchemas(inputObjectTypes);
    await generateModelSchemas(
      models,
      modelOperations,
      aggregateOperationSupport,
    );
    await generateIndex();
  } catch (error) {
    console.error(error);
  }
}

async function handleGeneratorOutputValue(generatorOutputValue: EnvValue) {
  const outputDirectoryPath = parseEnvValue(generatorOutputValue);

  // create the output directory and delete contents that might exist from a previous run
  await fs.mkdir(outputDirectoryPath, { recursive: true });
  const isRemoveContentsOnly = true;
  await removeDir(outputDirectoryPath, isRemoveContentsOnly);

  Transformer.setOutputPath(outputDirectoryPath);

  // Create tsconfig.json for TypeScript validation
  await createTsConfig(outputDirectoryPath);
}

async function createTsConfig(outputDirectoryPath: string) {
  const tsConfigPath = path.join(outputDirectoryPath, 'tsconfig.json');
  const tsConfigContent = JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: false,
        outDir: './dist',
        rootDir: './',
        baseUrl: './',
        paths: {
          '@prisma/client': [
            '../../../../node_modules/.pnpm/@prisma+client@4.16.2_prisma@4.16.2/node_modules/@prisma/client',
          ],
        },
      },
      include: ['schemas/**/*.ts'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2,
  );

  await fs.writeFile(tsConfigPath, tsConfigContent);
  console.log(`Created tsconfig.json at ${tsConfigPath}`);
}

function getGeneratorConfigByProvider(
  generators: GeneratorConfig[],
  provider: string,
) {
  return generators.find((it) => parseEnvValue(it.provider) === provider);
}

function checkForCustomPrismaClientOutputPath(
  prismaClientGeneratorConfig: GeneratorConfig | undefined,
) {
  if (prismaClientGeneratorConfig?.isCustomOutput) {
    Transformer.setPrismaClientOutputPath(
      prismaClientGeneratorConfig.output?.value as string,
    );
  }
}

async function generateEnumSchemas(
  prismaSchemaEnum: DMMF.SchemaEnum[],
  modelSchemaEnum: DMMF.SchemaEnum[],
) {
  const enumTypes = [...prismaSchemaEnum, ...modelSchemaEnum];
  const enumNames = enumTypes.map((enumItem) => enumItem.name);
  Transformer.enumNames = enumNames ?? [];
  const transformer = new Transformer({
    enumTypes,
  });
  await transformer.generateEnumSchemas();
}

async function generateObjectSchemas(inputObjectTypes: DMMF.InputType[]) {
  console.log(`Starting to generate ${inputObjectTypes.length} object schemas`);

  for (let i = 0; i < inputObjectTypes.length; i += 1) {
    try {
      const fields = inputObjectTypes[i]?.fields;
      const name = inputObjectTypes[i]?.name;

      console.log(
        `Processing object schema ${i + 1}/${
          inputObjectTypes.length
        }: ${name} with ${fields?.length || 0} fields`,
      );

      const transformer = new Transformer({ name, fields });
      await transformer.generateObjectSchema();
      console.log(`Successfully generated schema for: ${name}`);
    } catch (error) {
      console.error(
        `Error generating object schema ${i + 1}/${inputObjectTypes.length}:`,
        error,
      );
      throw error;
    }
  }

  console.log('Finished generating object schemas');
}

async function generateModelSchemas(
  models: DMMF.Model[],
  modelOperations: DMMF.ModelMapping[],
  aggregateOperationSupport: AggregateOperationSupport,
) {
  const transformer = new Transformer({
    models,
    modelOperations,
    aggregateOperationSupport,
  });
  await transformer.generateModelSchemas();
}

async function generateIndex() {
  await Transformer.generateIndex();
}
