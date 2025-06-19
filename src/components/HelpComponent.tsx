
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ChevronDown, ChevronRight, FileText, AlertCircle } from 'lucide-react';

interface DocItem {
    id: string;
    title: string;
    file?: string;
    children?: DocItem[];
}

interface DocsConfig {
    structure: DocItem[];
    defaultExpanded: string[];
    defaultDocument: string;
}

const HELP_DIR = 'help'

// Helper function to get the base path for assets
const getBasePath = () => {
    // In production (GitHub Pages), assets are served from /tectostress/
    // In development, they're served from the root
    const isProduction = process.env.NODE_ENV === 'production';
    return isProduction ? '/tectostress' : '';
};

const HelpComponent = () => {
    const [currentDoc, setCurrentDoc] = useState('');
    const [markdownContent, setMarkdownContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [docsStructure, setDocsStructure] = useState<DocItem[]>([]);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [configLoaded, setConfigLoaded] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);

    // Load configuration on component mount
    useEffect(() => {
        const loadConfiguration = async () => {
            try {
                const basePath = getBasePath();
                const response = await fetch(`${basePath}/${HELP_DIR}/docsStructure.json`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const config: DocsConfig = await response.json();

                setDocsStructure(config.structure);
                setExpandedSections(new Set(config.defaultExpanded));

                // Set default document if none is currently selected
                if (!currentDoc && config.defaultDocument) {
                    setCurrentDoc(config.defaultDocument);
                }

                setConfigLoaded(true);
                console.log('Documentation structure loaded successfully:', config);
            } catch (error) {
                console.error('Failed to load documentation configuration:', error);
                setConfigError('Failed to load documentation configuration');
                setConfigLoaded(true);
            }
        };

        loadConfiguration();
    }, []);

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    };

    const loadDocument = async (filePath: string) => {
        if (!filePath) return;

        setLoading(true);
        try {
            const basePath = getBasePath();
            const response = await fetch(`${basePath}/${HELP_DIR}/${filePath}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            setMarkdownContent(text);
        } catch (err) {
            console.error('Failed to load documentation:', err);
            setMarkdownContent(`# Error\n\nFailed to load document: ${filePath}\n\nPlease check that the file exists and is properly formatted.`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentDoc) {
            loadDocument(currentDoc);
        }
    }, [currentDoc]);

    // const renderNavItem = (item: DocItem, level: number = 0) => {
    //     const hasChildren = item.children && item.children.length > 0;
    //     const hasFile = !!item.file;
    //     const isExpanded = expandedSections.has(item.id);
    //     const isSelected = currentDoc === item.file;
    //     const paddingLeft = `${(level * 16) + 8}px`;

    //     return (
    //         <div key={item.id}>
    //             {hasChildren ? (
    //                 // Category with children (and possibly its own file)
    //                 <div className="flex items-center w-full" style={{ paddingLeft }}>
    //                     {/* Expand/collapse button */}
    //                     <button
    //                         onClick={() => toggleSection(item.id)}
    //                         className="flex items-center justify-center w-6 h-6 hover:bg-gray-300 rounded transition-colors mr-1"
    //                         title={isExpanded ? "Collapse section" : "Expand section"}
    //                     >
    //                         {isExpanded ? (
    //                             <ChevronDown className="w-4 h-4 text-gray-600" />
    //                         ) : (
    //                             <ChevronRight className="w-4 h-4 text-gray-600" />
    //                         )}
    //                     </button>

    //                     {/* Category title - clickable if it has a file */}
    //                     {hasFile ? (
    //                         <button
    //                             onClick={() => setCurrentDoc(item.file!)}
    //                             className={`flex-1 flex items-center p-2 text-left rounded transition-colors ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-200'
    //                                 }`}
    //                         >
    //                             <FileText className="w-4 h-4 mr-2 text-gray-500" />
    //                             <span className="font-medium text-gray-800">{item.title}</span>
    //                         </button>
    //                     ) : (
    //                         <div className="flex-1 flex items-center p-2">
    //                             <span className="font-medium text-gray-800">{item.title}</span>
    //                         </div>
    //                     )}
    //                 </div>
    //             ) : (
    //                 // Individual document (no children)
    //                 <button
    //                     onClick={() => item.file && setCurrentDoc(item.file)}
    //                     className={`flex items-center w-full p-2 text-left rounded transition-colors ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-200'
    //                         }`}
    //                     style={{ paddingLeft }}
    //                 >
    //                     <FileText className="w-4 h-4 mr-2 text-gray-500" />
    //                     <span>{item.title}</span>
    //                 </button>
    //             )}

    //             {/* Render children if expanded */}
    //             {hasChildren && isExpanded && (
    //                 <div>
    //                     {item.children!.map(child => renderNavItem(child, level + 1))}
    //                 </div>
    //             )}
    //         </div>
    //     );
    // };
    const renderNavItem = (item: DocItem, level: number = 0) => {
        const hasChildren = item.children && item.children.length > 0;
        const hasFile = !!item.file;
        const isExpanded = expandedSections.has(item.id);
        const isSelected = currentDoc === item.file;

        // More pronounced indentation
        const baseIndentation = level === 0 ? 8 : 8 + (level * 24);

        return (
            <div key={item.id}>
                {hasChildren ? (
                    // Category with children
                    <div
                        className="flex items-center w-full"
                        style={{ paddingLeft: `${baseIndentation}px` }}
                    >
                        {/* Expand/collapse button */}
                        <button
                            onClick={() => toggleSection(item.id)}
                            className="flex items-center justify-center w-4 h-4 hover:bg-gray-300 rounded transition-colors mr-1 flex-shrink-0"
                            title={isExpanded ? "Collapse section" : "Expand section"}
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-gray-600" />
                            ) : (
                                <ChevronRight className="w-3 h-3 text-gray-600" />
                            )}
                        </button>

                        {/* Category title */}
                        {hasFile ? (
                            <button
                                onClick={() => setCurrentDoc(item.file!)}
                                className={`flex-1 flex items-center py-1.5 px-2 ml-1 text-left rounded transition-colors ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-200'
                                    }`}
                            >
                                <FileText className="w-4 h-4 mr-1.5 flex-shrink-0 text-gray-500" />
                                <span className={`${level === 0 ? 'font-medium' : 'font-normal'} text-gray-800`}>
                                    {item.title}
                                </span>
                            </button>
                        ) : (
                            <div className="flex-1 flex items-center py-1.5 px-2 ml-1">
                                <span className={`${level === 0 ? 'font-medium' : 'font-normal'} text-gray-800`}>
                                    {item.title}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    // Individual document (leaf node)
                    <button
                        onClick={() => item.file && setCurrentDoc(item.file)}
                        className={`flex items-center w-full py-1.5 px-2 text-left rounded transition-colors ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-200'
                            }`}
                        style={{ paddingLeft: `${baseIndentation + 20}px` }}
                    >
                        <FileText className="w-4 h-4 mr-1.5 flex-shrink-0 text-gray-500" />
                        <span className="text-gray-700 text-sm">{item.title}</span>
                    </button>
                )}

                {/* Render children if expanded */}
                {hasChildren && isExpanded && (
                    <div className="mt-1">
                        {item.children!.map(child => renderNavItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Loading state while configuration is being loaded
    if (!configLoaded) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading documentation structure...</div>
            </div>
        );
    }

    // Error state if configuration failed to load
    if (configError) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-red-500 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {configError}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full">
            {/* Navigation sidebar */}
            <div className="w-80 bg-gray-100 p-4 border-r overflow-y-auto">
                <h3 className="font-bold mb-4 text-lg text-gray-800">Documentation</h3>
                <nav className="space-y-1">
                    {docsStructure.map(item => renderNavItem(item))}
                </nav>
            </div>

            {/* Content area */}
            <div className="flex-1 p-6 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="text-gray-500">Loading...</div>
                    </div>
                ) : markdownContent ? (
                    <div className="prose prose-lg max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                                img: ({ node, src, alt, ...props }) => {
                                    // Handle relative image paths
                                    let imageSrc = src;
                                    const basePath = getBasePath();
                                    if (src?.startsWith('./images/')) {
                                        imageSrc = src.replace('./images/', `${basePath}/${HELP_DIR}/images/`);
                                    } else if (src?.startsWith('images/')) {
                                        imageSrc = `${basePath}/${HELP_DIR}/images/${src.replace('images/', '')}`;
                                    } else if (src?.startsWith('../images/')) {
                                        imageSrc = src.replace('../images/', `${basePath}/${HELP_DIR}/images/`);
                                    }

                                    // Parse size from alt text using different formats
                                    let imageAlt = alt;
                                    let imageWidth = null;
                                    let imageHeight = null;

                                    if (alt) {
                                        // Format 1: ![Alt text|width](url) or ![Alt text|width|height](url)
                                        if (alt.includes('|')) {
                                            const parts = alt.split('|');
                                            imageAlt = parts[0].trim();
                                            if (parts[1]) imageWidth = parts[1].trim();
                                            if (parts[2]) imageHeight = parts[2].trim();
                                        }
                                        // Format 2: ![Alt text (width)](url) or ![Alt text (width x height)](url)
                                        else if (alt.includes('(') && alt.includes(')')) {
                                            const match = alt.match(/^(.*?)\s*\(([^)]+)\)$/);
                                            if (match) {
                                                imageAlt = match[1].trim();
                                                const sizeInfo = match[2].trim();

                                                // Check if it's "width x height" format
                                                if (sizeInfo.includes('x')) {
                                                    const [w, h] = sizeInfo.split('x').map(s => s.trim());
                                                    imageWidth = w;
                                                    imageHeight = h;
                                                } else {
                                                    // Just width
                                                    imageWidth = sizeInfo;
                                                }
                                            }
                                        }
                                        // Format 3: ![Alt text @width](url) 
                                        else if (alt.includes('@')) {
                                            const parts = alt.split('@');
                                            imageAlt = parts[0].trim();
                                            if (parts[1]) imageWidth = parts[1].trim();
                                        }
                                    }

                                    // Create style object
                                    const imageStyle = {
                                        maxWidth: '100%',
                                        height: 'auto',
                                        display: 'block',
                                        margin: '0 auto'
                                    };

                                    // Apply width if specified
                                    if (imageWidth) {
                                        const width = imageWidth.endsWith('px') ? imageWidth : `${imageWidth}px`;
                                        imageStyle.width = width;
                                        imageStyle.maxWidth = width;
                                    }

                                    // Apply height if specified
                                    if (imageHeight) {
                                        const height = imageHeight.endsWith('px') ? imageHeight : `${imageHeight}px`;
                                        imageStyle.height = height;
                                    }

                                    return (
                                        <img
                                            src={imageSrc}
                                            alt={imageAlt || 'Documentation image'}
                                            className="my-4 rounded-lg shadow-md"
                                            style={imageStyle}
                                            onError={(e) => {
                                                console.error(`Failed to load image: ${imageSrc}`);
                                                e.currentTarget.style.border = '2px dashed #ccc';
                                                e.currentTarget.style.padding = '20px';
                                                e.currentTarget.alt = `⚠️ Image not found: ${imageSrc}`;
                                            }}
                                            {...props}
                                        />
                                    );
                                },
                                p: ({ node, children, ...props }) => {
                                    // Check if paragraph contains only an image
                                    if (
                                        node?.children?.length === 1 &&
                                        node.children[0].type === 'element' &&
                                        node.children[0].tagName === 'img'
                                    ) {
                                        return <div className="text-center my-6">{children}</div>;
                                    }
                                    return <p className="mb-4 text-gray-700 leading-relaxed" {...props}>{children}</p>;
                                },
                                a: ({ node, href, children, ...props }) => {
                                    // Check if it's an internal markdown link
                                    if (href?.endsWith('.md')) {
                                        // Handle relative paths
                                        let targetDoc = href;

                                        // Convert relative paths to absolute paths from help root
                                        if (href.startsWith('../')) {
                                            // Handle ../theory/file.md from data/ folder
                                            targetDoc = href.replace('../', '');
                                        } else if (href.startsWith('./')) {
                                            // Handle ./file.md in same folder
                                            const currentPath = currentDoc.includes('/')
                                                ? currentDoc.substring(0, currentDoc.lastIndexOf('/') + 1)
                                                : '';
                                            targetDoc = currentPath + href.replace('./', '');
                                        } else if (!href.includes('/')) {
                                            // Handle file.md in same folder
                                            const currentPath = currentDoc.includes('/')
                                                ? currentDoc.substring(0, currentDoc.lastIndexOf('/') + 1)
                                                : '';
                                            targetDoc = currentPath + href;
                                        }

                                        return (
                                            <button
                                                onClick={() => setCurrentDoc(targetDoc)}
                                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                                                title={`Navigate to ${targetDoc}`}
                                            >
                                                {children}
                                            </button>
                                        );
                                    }

                                    // External links
                                    return (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 hover:underline"
                                            {...props}
                                        >
                                            {children}
                                        </a>
                                    );
                                }
                            }}
                        >
                            {markdownContent}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-32">
                        <div className="text-gray-500">Select a topic from the sidebar</div>
                    </div>
                )
                }
            </div >
        </div >
    );
};

export default HelpComponent;