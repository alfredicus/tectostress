import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Terminal, X, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';

// Console message types
export interface ConsoleMessage {
    id: string;
    timestamp: Date;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    details?: string;
}

export interface ConsoleComponentProps {
    messages: ConsoleMessage[];
    onClear: () => void;
    isOpen: boolean;
    onToggle: () => void;
    maxHeight?: string;
}

export const ConsoleComponent: React.FC<ConsoleComponentProps> = ({
    messages,
    onClear,
    isOpen,
    onToggle,
    maxHeight = '300px'
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    // Filter messages based on selected filter
    const filteredMessages = messages.filter(msg =>
        filter === 'all' || msg.type === filter
    );

    // Count messages by type
    const messageCounts = messages.reduce((acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Get icon for message type
    const getMessageIcon = (type: ConsoleMessage['type']) => {
        switch (type) {
            case 'info':
                return <Info className="w-4 h-4 text-blue-500" />;
            case 'warning':
                return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'success':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            default:
                return <Info className="w-4 h-4 text-gray-500" />;
        }
    };

    // Get message styling
    const getMessageStyling = (type: ConsoleMessage['type']) => {
        switch (type) {
            case 'info':
                return 'border-l-blue-400 bg-blue-50';
            case 'warning':
                return 'border-l-yellow-400 bg-yellow-50';
            case 'error':
                return 'border-l-red-400 bg-red-50';
            case 'success':
                return 'border-l-green-400 bg-green-50';
            default:
                return 'border-l-gray-400 bg-gray-50';
        }
    };

    // Format timestamp
    const formatTimestamp = (timestamp: Date) => {
        return timestamp.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    };

    return (
        <div className="mt-6 bg-white border rounded-lg shadow-sm overflow-hidden">
            {/* Console Header */}
            <div
                className="flex justify-between items-center px-6 py-4 bg-gray-900 text-white cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center space-x-3">
                    {/* <Terminal className="w-5 h-5" /> */}
                    <h3 className="text-lg font-medium">Console</h3>
                    {messages.length > 0 && (
                        <span className="px-2 py-1 bg-gray-700 rounded-md text-xs">
                            {messages.length} message{messages.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    {/* Message type counts */}
                    {messageCounts.error > 0 && (
                        <span className="px-2 py-1 bg-red-600 rounded-md text-xs">
                            {messageCounts.error} error{messageCounts.error !== 1 ? 's' : ''}
                        </span>
                    )}
                    {messageCounts.warning > 0 && (
                        <span className="px-2 py-1 bg-yellow-600 rounded-md text-xs">
                            {messageCounts.warning} warning{messageCounts.warning !== 1 ? 's' : ''}
                        </span>
                    )}
                    {messageCounts.info > 0 && (
                        <span className="px-2 py-1 bg-blue-600 rounded-md text-xs">
                            {messageCounts.info} info
                        </span>
                    )}
                    {messageCounts.success > 0 && (
                        <span className="px-2 py-1 bg-green-600 rounded-md text-xs">
                            {messageCounts.success} success
                        </span>
                    )}

                    {isOpen ?
                        <ChevronUp className="w-5 h-5" /> :
                        <ChevronDown className="w-5 h-5" />
                    }
                </div>
            </div>

            {/* Console Content */}
            {isOpen && (
                <div className="border-t border-gray-200">
                    {/* Console Controls */}
                    <div className="flex justify-between items-center px-6 py-3 bg-gray-50 border-b">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">Filter:</span>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All ({messages.length})</option>
                                {messageCounts.info > 0 && (
                                    <option value="info">Info ({messageCounts.info})</option>
                                )}
                                {messageCounts.warning > 0 && (
                                    <option value="warning">Warnings ({messageCounts.warning})</option>
                                )}
                                {messageCounts.error > 0 && (
                                    <option value="error">Errors ({messageCounts.error})</option>
                                )}
                                {messageCounts.success > 0 && (
                                    <option value="success">Success ({messageCounts.success})</option>
                                )}
                            </select>
                        </div>

                        <button
                            onClick={onClear}
                            className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Clear console"
                        >
                            <X className="w-4 h-4" />
                            <span>Clear</span>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div
                        className="overflow-y-auto bg-gray-900 text-gray-100 font-mono text-sm"
                        style={{ maxHeight }}
                    >
                        {filteredMessages.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                {messages.length === 0 ? (
                                    <>
                                        {/* <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" /> */}
                                        <p>No messages to display</p>
                                        <p className="text-xs mt-1">Console output will appear here</p>
                                    </>
                                ) : (
                                    <p>No {filter} messages to display</p>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 space-y-2">
                                {filteredMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`border-l-4 pl-4 py-2 rounded-r ${getMessageStyling(msg.type)}`}
                                    >
                                        <div className="flex items-start space-x-2">
                                            <div className="flex-shrink-0 mt-0.5">
                                                {getMessageIcon(msg.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <span className="text-xs text-gray-500 font-normal">
                                                        {formatTimestamp(msg.timestamp)}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded uppercase font-semibold ${msg.type === 'error' ? 'bg-red-100 text-red-800' :
                                                            msg.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                                                msg.type === 'success' ? 'bg-green-100 text-green-800' :
                                                                    'bg-blue-100 text-blue-800'
                                                        }`}>
                                                        {msg.type}
                                                    </span>
                                                </div>
                                                <div className="text-gray-800 break-words">
                                                    {msg.message}
                                                </div>
                                                {msg.details && (
                                                    <div className="mt-2 text-sm text-gray-600 bg-gray-100 p-2 rounded">
                                                        <pre className="whitespace-pre-wrap font-mono text-xs">
                                                            {msg.details}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Example usage component showing how to integrate with RunComponent
// const ExampleUsage: React.FC = () => {
//     const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
//     const [isConsoleOpen, setIsConsoleOpen] = useState(true);

//     // Helper function to add messages to console
//     const addConsoleMessage = (
//         type: ConsoleMessage['type'],
//         message: string,
//         details?: string
//     ) => {
//         const newMessage: ConsoleMessage = {
//             id: `msg-${Date.now()}-${Math.random()}`,
//             timestamp: new Date(),
//             type,
//             message,
//             details
//         };

//         setConsoleMessages(prev => [...prev, newMessage]);
//     };

//     // Example of how to use in your simulation process
//     const simulateProcess = () => {
//         addConsoleMessage('info', 'Starting simulation process...');

//         setTimeout(() => {
//             addConsoleMessage('info', 'Processing 15 data files...');
//         }, 1000);

//         setTimeout(() => {
//             addConsoleMessage('warning', 'Skipped 3 items due to invalid data format',
//                 'Files: data1.csv (row 5), data2.csv (row 12), data3.csv (row 8)');
//         }, 2000);

//         setTimeout(() => {
//             addConsoleMessage('error', 'Failed to process extension fracture data',
//                 'Error: Invalid strike value (365°) in file "fractures.csv" at row 23');
//         }, 3000);

//         setTimeout(() => {
//             addConsoleMessage('success', 'Simulation completed successfully!');
//             addConsoleMessage('info', 'Results: Stress ratio = 0.75, Fit = 89.3%');
//         }, 4000);
//     };

//     const clearConsole = () => {
//         setConsoleMessages([]);
//     };

//     return (
//         <div className="p-6 space-y-6">
//             <div className="bg-white p-6 rounded-lg border">
//                 <h2 className="text-xl font-bold mb-4">Console Integration Example</h2>

//                 <div className="space-x-2 mb-4">
//                     <button
//                         onClick={simulateProcess}
//                         className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
//                     >
//                         Run Simulation
//                     </button>

//                     <button
//                         onClick={() => addConsoleMessage('info', 'Manual info message')}
//                         className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
//                     >
//                         Add Info
//                     </button>

//                     <button
//                         onClick={() => addConsoleMessage('warning', 'Manual warning message')}
//                         className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
//                     >
//                         Add Warning
//                     </button>

//                     <button
//                         onClick={() => addConsoleMessage('error', 'Manual error message')}
//                         className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
//                     >
//                         Add Error
//                     </button>
//                 </div>
//             </div>

//             <ConsoleComponent
//                 messages={consoleMessages}
//                 onClear={clearConsole}
//                 isOpen={isConsoleOpen}
//                 onToggle={() => setIsConsoleOpen(!isConsoleOpen)}
//                 maxHeight="400px"
//             />
//         </div>
//     );
// };

// export default ExampleUsage;