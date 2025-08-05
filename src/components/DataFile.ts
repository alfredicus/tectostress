/**
 * Purpose:
 * 
 * Represents a data file that has been uploaded and parsed.
 * Contains both the raw data and layout information for grid positioning.
 * 
 * Evolution:
 * 
 * The interface has evolved from using string[][] for content to
 * Record<string, any> to support more flexible data structures with named columns.
 */
export interface DataFile {
    id: string;                    // Unique identifier for the file
    name: string;                  // Original filename
    headers: string[];             // Column headers from the file
    content: Record<string, any>;  // File data as key-value pairs (newer version)
    // content: string[][];        // File data as 2D array (older version)
    layout: {                      // Grid layout properties
        x: number;                 // X position in grid
        y: number;                 // Y position in grid  
        w: number;                 // Width in grid units
        h: number;                 // Height in grid units
    };
}

export type DataFiles = DataFile[];