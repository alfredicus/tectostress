/**
 * @brief A utility class to manage type synonyms
 */
export class TypeSynonyms {
    private static table_: Map<string, string[]> = new Map([
        ['joint', ['extension fracture', 'tension fracture', 'tensile fracture', 'open fracture', 'vein', 'tension gash', 'joint', 'dike', 'dyke']],
        ['fault', ['shear fracture', 'fault', 'brittle shear fracture', 'brittle fault', 'striated fault plane', 'striated plane']],
        ['stylolite', ['stylolite', 'pressure solution seam', 'pressure solution surface', 'stylolite plane', 'stylolite interface']]
    ]);

    // Private constructor prevents instantiation
    private constructor() { }

    /**
     * @brief Add synonyms for a given type
     */
    static addSynonyms(type: string, synonyms: string[]): void {
        this.table_.set(beautifyName(type), synonyms.map(s => beautifyName(s)));
    }

    /**
     * @brief Get all synonyms for a given type
     */
    static getSynonyms(type: string): string[] {
        if (!this.typeExists(type)) {
            throw `type ${type} does not exist`;
        }
        return this.table_.get(beautifyName(type)) || [];
    }

    /**
     * @brief Verify if a synonym belongs to a type
     * @param type The main type (e.g., 'joint')
     * @param synonym The synonym to verify (e.g., 'vein')
     * @returns True if the synonym belongs to the type, false otherwise
     */
    static isSameType(type: string, synonym: string): boolean {
        if (!this.typeExists(type)) {
            throw `type ${type} does not exist`;
        }
        return this.getSynonyms(type).includes(beautifyName(synonym));
    }

    /**
     * @brief Check if a type exists in the table
     */
    static typeExists(type: string): boolean {
        return this.table_.has(beautifyName(type));
    }
}

function beautifyName(name: string): string {
    return name.toLowerCase().replace('_', ' ').trim();
}