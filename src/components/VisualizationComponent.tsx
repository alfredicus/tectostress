


// import React from 'react';
// import RoseDiagramComponent from './RoseDiagramComponent';
// import StressSphereComponent from './StressSphereComponent';
// import Test2DComponent from './Test2DComponent';
// import Test3DComponent from './Test3DComponent';
// import VisualizationProps from './VisualizationProps';
// import TableComponent from './TableComponent';
// import WulffStereonetComponent from './WulffStereonetComponent';
// import HistogramComponent from './HistogramComponent';

// interface EnhancedVisualizationProps extends VisualizationProps {import React from 'react';
import RoseDiagramComponent from './RoseDiagramComponent';
import StressSphereComponent from './StressSphereComponent';
import Test2DComponent from './Test2DComponent';
import Test3DComponent from './Test3DComponent';
import VisualizationProps from './VisualizationProps';
import TableComponent from './TableComponent';
import WulffStereonetComponent from './WulffStereonetComponent';
import HistogramComponent from './HistogramComponent';

interface EnhancedVisualizationProps extends VisualizationProps {
    onDimensionChange?: (newWidth: number, newHeight: number) => void;
}

export const VisualizationComponent: React.FC<EnhancedVisualizationProps> = ({
    type,
    files,
    width,
    height,
    state,
    onStateChange,
    onDimensionChange
}) => {
    switch (type) {
        case 'rose':
            return (
                <RoseDiagramComponent
                    files={files}
                    width={width}
                    height={height}
                    onDimensionChange={onDimensionChange}
                />
            );
        case 'wulff':
            return (
                <WulffStereonetComponent
                    files={files}
                    width={width}
                    height={height}
                    onDimensionChange={onDimensionChange}
                />
            );
        case 'histogram':
            return (
                <HistogramComponent
                    files={files}
                    width={width}
                    height={height}
                    onDimensionChange={onDimensionChange}
                />
            );
        default:
            return <div>Unknown visualization type</div>;
    }
};
