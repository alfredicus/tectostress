// The camelCase copies added for the library are not shown as extra columns
import { isAliasColumn, processCSV } from '../CSVParsing';

test('aliases are recognised, the measured columns are not', () => {
    const row = processCSV('id;type;strike;dip;Dip direction;Rake;Strike direction;Type of movement\n1;Striated Plane;90;45;S;60;E;Inverse').data[0];
    expect(row.dipDirection).toBe(row['dip direction']);   // still there for the library
    const shown = Object.keys(row).filter(k => !isAliasColumn(row, k));
    expect(shown).toEqual(['id', 'type', 'strike', 'dip', 'dip direction', 'rake', 'strike direction', 'type of movement']);
});
