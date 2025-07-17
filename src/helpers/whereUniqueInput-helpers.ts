import { DMMF } from '@prisma/generator-helper';

export function changeOptionalToRequiredFields(
  inputObjectTypes: DMMF.InputType[],
): DMMF.InputType[] {
  return inputObjectTypes.map((item) => {
    if (item.name.includes('WhereUniqueInput')) {
      // For WhereUniqueInput types, if minNumFields and maxNumFields are both 1,
      // it means exactly one field must be provided, so we make all fields required
      if (
        item.constraints.minNumFields === 1 &&
        item.constraints.maxNumFields === 1
      ) {
        item.fields = item.fields.map((subItem: DMMF.SchemaArg) => {
          subItem.isRequired = true;
          return subItem;
        });
      } else if (item.constraints.fields?.length! > 0) {
        // Fallback to the original logic if constraints.fields is available
        item.fields = item.fields.map((subItem: DMMF.SchemaArg) => {
          if (item.constraints.fields?.includes(subItem.name)) {
            subItem.isRequired = true;
            return subItem;
          }
          return subItem;
        });
      }
    }
    return item;
  });
}
