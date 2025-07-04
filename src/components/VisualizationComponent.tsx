import React from 'react';
import RoseDiagramComponent from './RoseDiagramComponent';
import StressSphereComponent from './StressSphereComponent';
import Test2DComponent from './Test2DComponent';
import Test3DComponent from './Test3DComponent';
import VisualizationProps from './VisualizationProps';
import TableComponent from './TableComponent';
import WulffStereonetComponent from './WulffStereonetComponent';
import HistogramComponent from './HistogramComponent';

export const VisualizationComponent: React.FC<VisualizationProps> = ({
    type,
    files,
    width,
    height,
    state,
    onStateChange
}) => {
    switch (type) {
        case 'rose':
            return <RoseDiagramComponent files={files} width={width} height={height} />;
        // case 'table':
        //     return <TableComponent files={files} />;
        // case 'sphere':
        //     return (
        //         <StressSphereComponent
        //             files={files}
        //             width={width}
        //             height={height}
        //             initialState={state?.type === 'sphere' ? state : undefined}
        //             onStateChange={onStateChange}
        //         />
        //     );
        // case 'two':
        //     return <Test2DComponent />;
        // case 'three':
        //     return <Test3DComponent />;
        case 'wulff':
            return <WulffStereonetComponent
                files={files}
                // width={width}
                // height={height}
            />;
         case 'histogram':
            return <HistogramComponent
                files={files}
                width={width}
                height={height}
            />;
        default:
            return <div>Unknown visualization type</div>;
    }
};
