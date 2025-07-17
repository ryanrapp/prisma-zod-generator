import fs from 'fs';
import path from 'path';
import { formatFile } from './formatFile';
import { addIndexExport } from './writeIndexFile';

export const writeFileSafely = async (
  writeLocation: string,
  content: any,
  addToIndex = true,
) => {
  try {
    console.log(`    writeFileSafely: Creating directory for ${writeLocation}`);
    fs.mkdirSync(path.dirname(writeLocation), {
      recursive: true,
    });

    console.log(`    writeFileSafely: Formatting content for ${writeLocation}`);
    const formattedContent = await formatFile(content);
    console.log(
      `    writeFileSafely: Content formatted successfully, length: ${formattedContent.length}`,
    );

    console.log(`    writeFileSafely: Writing file ${writeLocation}`);
    fs.writeFileSync(writeLocation, formattedContent);
    console.log(`    writeFileSafely: File written successfully`);

    if (addToIndex) {
      console.log(`    writeFileSafely: Adding to index`);
      addIndexExport(writeLocation);
      console.log(`    writeFileSafely: Added to index successfully`);
    }
  } catch (error) {
    console.error(
      `writeFileSafely: Error writing file ${writeLocation}:`,
      error,
    );
    throw error;
  }
};
