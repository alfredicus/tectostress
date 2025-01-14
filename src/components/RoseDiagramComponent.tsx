import React, { useEffect, useRef, useState } from 'react';
import { RoseDiagram } from './views/RoseDiagram'
import { SharedData } from './types';

interface RoseDiagramProps {
    width?: number;
    height?: number;
    className?: string;
    sharedData?: SharedData;
    onDataUpdate?: (data: any) => void;

}

interface DataInfo {
    filename: string;
    nbData: number;
    min: number;
    max: number;
}

const RoseDiagramComponent: React.FC<RoseDiagramProps> = ({
    width = 400,
    height = 2000,
    className = '',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [rose, setRose] = useState<any>(null); // Replace 'any' with your RoseDiagram type
    const [dataInfo, setDataInfo] = useState<DataInfo>({
        filename: '',
        nbData: 0,
        min: 0,
        max: 0,
    });
    const [settings, setSettings] = useState({
        binAngle: '10',
        binColor: '#FF0000',
        lineColor: '#000000',
        showLines: true,
        is360: false,
        showLabels: false,
        showCardinals: true,
        showCircles: true,
        innerRadius: 5,
    });
    const [columns, setColumns] = useState<string[]>([]);
    const [selectedColumn, setSelectedColumn] = useState<number>(0);
    const [datas, setDatas] = useState<number[][]>([]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Generate random initial data
        const randomData = new Array(100).fill(0).map(() =>
            Math.random() * 180
        );

        // Initialize Rose Diagram
        const newRose = new RoseDiagram('rose-container', randomData, {
            width: 300,
            height: 300,
        });

        setRose(newRose);
        updateDataInfo('', randomData);
    }, []);

    const updateDataInfo = (filename: string, data: number[]) => {
        setDataInfo({
            filename,
            nbData: data.length,
            min: Math.min(...data),
            max: Math.max(...data),
        });
    };

    const trimAll = (s: string): string => {
        return s
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/, '')
            .replace('\t', ' ')
            .trimEnd();
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split('\n');
        const newDatas: number[][] = [];
        const newColumns: string[] = [];

        lines.forEach((line, i) => {
            line = trimAll(line);
            if (line.length === 0) return;

            const tokens = line.split(' ');
            if (i === 0) {
                // Handle header
                if (tokens[0] === '#') tokens.shift();
                tokens.forEach((token) => {
                    newColumns.push(token);
                    newDatas.push([]);
                });
            } else {
                // Handle data
                tokens.forEach((token, j) => {
                    newDatas[j].push(parseFloat(token));
                });
            }
        });

        setColumns(newColumns);
        setDatas(newDatas);
        if (rose && newDatas[0]) {
            rose.data = newDatas[0];
            updateDataInfo(file.name, newDatas[0]);
            rose.update();
        }
    };

    const updateRoseSetting = (
        setting: keyof typeof settings,
        value: string | number | boolean
    ) => {
        setSettings(prev => ({ ...prev, [setting]: value }));
        if (!rose) return;

        switch (setting) {
            case 'binAngle':
                rose.binAngle = value;
                break;
            case 'binColor':
                rose.fillColor = value;
                break;
            case 'lineColor':
                rose.lineColor = value;
                break;
            case 'showLines':
                rose.binBorder = value;
                break;
            case 'is360':
                rose.is360 = value;
                break;
            case 'showLabels':
                rose.labels = value;
                break;
            case 'showCardinals':
                rose.cardinals = value;
                break;
            case 'showCircles':
                rose.circles = value;
                break;
            case 'innerRadius':
                rose.innerRadius = value;
                break;
        }
        rose.update();
    };

    return (
        <div className="flex gap-4">
            {/* Rose Diagram Container */}
            <div>
                <div
                    id="rose-container"
                    ref={containerRef}
                    className={`w-[400px] h-[400px] ${className}`}
                />
                {/* Data Info Panel */}
                <div className="mt-4 p-4 border rounded bg-white">
                    <h3 className="text-lg font-bold mb-2">Data Info</h3>
                    <div className="space-y-1">
                        <p>File name: <b>{dataInfo.filename || 'Random data'}</b></p>
                        <p>Nb data: <b>{dataInfo.nbData}</b></p>
                        <p>Min: <b>{dataInfo.min.toFixed(2)}</b></p>
                        <p>Max: <b>{dataInfo.max.toFixed(2)}</b></p>
                    </div>
                </div>
            </div>

            {/* Controls Panel */}
            <div className="w-[340px] bg-gray-300 p-4 rounded border">
                <div className="space-y-4">
                    {/* File Upload */}
                    <div>
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                        />
                        <button
                            onClick={() => document.getElementById('file-upload')?.click()}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Upload
                        </button>

                        {columns.length > 0 && (
                            <select
                                value={selectedColumn}
                                onChange={(e) => {
                                    const col = parseInt(e.target.value);
                                    setSelectedColumn(col);
                                    if (rose && datas[col]) {
                                        rose.data = datas[col];
                                        rose.update();
                                        updateDataInfo(dataInfo.filename, datas[col]);
                                    }
                                }}
                                className="ml-2 p-1"
                            >
                                {columns.map((col, i) => (
                                    <option key={i} value={i}>{col}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Bin Settings */}
                    <div>
                        <label className="block mb-1">Bin angle</label>
                        <select
                            value={settings.binAngle}
                            onChange={(e) => updateRoseSetting('binAngle', e.target.value)}
                            className="p-1"
                        >
                            {[2, 3, 5, 6, 10, 15, 30].map(angle => (
                                <option key={angle} value={angle}>{angle}</option>
                            ))}
                        </select>
                        <input
                            type="color"
                            value={settings.binColor}
                            onChange={(e) => updateRoseSetting('binColor', e.target.value)}
                            className="ml-2"
                        />
                    </div>

                    {/* Display Options */}
                    <div className="space-y-2">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={settings.showLines}
                                onChange={(e) => updateRoseSetting('showLines', e.target.checked)}
                                className="mr-2"
                            />
                            Show lines
                            <input
                                type="color"
                                value={settings.lineColor}
                                onChange={(e) => updateRoseSetting('lineColor', e.target.value)}
                                className="ml-2"
                            />
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={settings.is360}
                                onChange={(e) => updateRoseSetting('is360', e.target.checked)}
                                className="mr-2"
                            />
                            Is 360
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={settings.showLabels}
                                onChange={(e) => updateRoseSetting('showLabels', e.target.checked)}
                                className="mr-2"
                            />
                            Show labels
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={settings.showCardinals}
                                onChange={(e) => updateRoseSetting('showCardinals', e.target.checked)}
                                className="mr-2"
                            />
                            Show cardinals
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={settings.showCircles}
                                onChange={(e) => updateRoseSetting('showCircles', e.target.checked)}
                                className="mr-2"
                            />
                            Show circles
                        </label>
                    </div>

                    {/* Inner Radius Slider */}
                    <div>
                        <label className="block mb-1">
                            Inner radius: {settings.innerRadius}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.innerRadius}
                            onChange={(e) => updateRoseSetting('innerRadius', e.target.value)}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoseDiagramComponent;