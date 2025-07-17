import prettier from 'prettier';

export const formatFile = (content: string): Promise<string> => {
  return new Promise((res, rej) => {
    console.log(
      `formatFile: Starting prettier formatting for content length: ${content.length}`,
    );

    prettier
      .resolveConfig(process.cwd())
      .then((options) => {
        console.log(
          `formatFile: Prettier config resolved:`,
          options ? 'found' : 'not found',
        );

        let formatOptions = options;
        if (!options) {
          formatOptions = {
            trailingComma: 'all',
            tabWidth: 2,
            printWidth: 80,
            bracketSpacing: true,
            semi: true,
            singleQuote: true,
            useTabs: false,
          };
        }

        console.log(`formatFile: Using prettier options:`, formatOptions);

        console.log(`formatFile: Calling prettier.format...`);
        try {
          const formatted = prettier.format(content, {
            ...formatOptions,
            parser: 'typescript',
          });
          console.log(
            `formatFile: Prettier formatting successful, output length: ${formatted.length}`,
          );
          res(formatted);
        } catch (error) {
          console.error(`formatFile: Prettier formatting failed:`, error);
          rej(error);
        }
      })
      .catch((error) => {
        console.error(`formatFile: Failed to resolve prettier config:`, error);
        rej(error);
      });
  });
};
