import * as React from 'react';
import Button from '@mui/material/Button';

export default function DataComponent() {
  return <Button variant="contained">Hello world</Button>;
  // return <div/>
}

// import React, { useState, useRef, useEffect } from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   Paper,
//   Box,
//   AppBar,
//   Toolbar,
//   IconButton,
//   Typography,
//   Drawer,
//   List,
//   ListItem,
//   ListItemButton,
//   ListItemIcon,
//   ListItemText,
//   TextField
// } from '@mui/material';
// import {
//   ChevronLeft,
//   ChevronRight,
//   HelpOutline,
//   Upload,
//   Assessment,
//   BarChart
// } from '@mui/icons-material';
// import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// const drawerWidth = 240;

// const DataAnalysisApp = () => {
//   const [data, setData] = useState<string[][]>([
//     ['1', '', '', '', ''],
//     ['2', '', '', '', ''],
//     ['3', '', '', '', ''],
//     ['4', '', '', '', '']
//   ]);
//   const [isDrawerOpen, setIsDrawerOpen] = useState(true);
//   const [fileName, setFileName] = useState<string | null>(null);
//   const [histogramData, setHistogramData] = useState<{ name: string; value: number }[]>([]);
//   const [calculations, setCalculations] = useState<{
//     mean: number | null;
//     median: number | null;
//     mode: string | null
//   }>({ mean: null, median: null, mode: null });
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   // Rest of the logic functions remain the same
//   const handleInputChange = (rowIndex: number, colIndex: number, value: string) => {
//     const newData = [...data];
//     newData[rowIndex][colIndex] = value;
//     setData(newData);
//   };

//   const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (file) {
//       setFileName(file.name);
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const content = e.target?.result as string;
//         const rows = content.split('\n').map(row => row.split(','));
//         setData(rows);
//       };
//       reader.readAsText(file);
//     }
//   };

//   const analyzeData = () => {
//     // Analysis logic remains the same
//   };

//   useEffect(() => {
//     if (data.length > 1) {
//       analyzeData();
//     }
//   }, [data]);

//   return (
//     <Box sx={{ display: 'flex', minHeight: '100vh' }}>
//       <AppBar position="fixed" sx={{ zIndex: 2000 }}>
//         <Toolbar>
//           <IconButton
//             color="inherit"
//             onClick={() => setIsDrawerOpen(!isDrawerOpen)}
//             edge="start"
//           >
//             {isDrawerOpen ? <ChevronLeft /> : <ChevronRight />}
//           </IconButton>
//           <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
//             File Analysis
//           </Typography>
//           <IconButton color="inherit">
//             <HelpOutline />
//           </IconButton>
//         </Toolbar>
//       </AppBar>

//       <Drawer
//         variant="persistent"
//         anchor="left"
//         open={isDrawerOpen}
//         sx={{
//           width: drawerWidth,
//           '& .MuiDrawer-paper': {
//             width: drawerWidth,
//             boxSizing: 'border-box',
//             top: 64,
//             height: 'calc(100% - 64px)'
//           },
//         }}
//       >
//         <List>
//           <ListItem>
//             <input
//               type="file"
//               ref={fileInputRef}
//               onChange={handleFileUpload}
//               style={{ display: 'none' }}
//               accept=".csv,.txt"
//             />
//             <ListItemButton onClick={() => fileInputRef.current?.click()}>
//               <ListItemIcon><Upload /></ListItemIcon>
//               <ListItemText primary="Input" />
//             </ListItemButton>
//           </ListItem>
//           <ListItem>
//             <ListItemButton onClick={analyzeData}>
//               <ListItemIcon><Assessment /></ListItemIcon>
//               <ListItemText primary="Analyse" />
//             </ListItemButton>
//           </ListItem>
//           <ListItem>
//             <ListItemButton>
//               <ListItemIcon><BarChart /></ListItemIcon>
//               <ListItemText primary="Display" />
//             </ListItemButton>
//           </ListItem>
//           {fileName && (
//             <ListItem>
//               <Typography variant="caption" color="text.secondary">
//                 Uploaded: {fileName}
//               </Typography>
//             </ListItem>
//           )}
//         </List>
//       </Drawer>

//       <Box
//         component="main"
//         sx={{
//           flexGrow: 1,
//           p: 3,
//           mt: 8,
//           ml: isDrawerOpen ? `${drawerWidth}px` : 0,
//           transition: theme => theme.transitions.create('margin', {
//             easing: theme.transitions.easing.sharp,
//             duration: theme.transitions.duration.leavingScreen,
//           }),
//         }}
//       >
//         <TableContainer component={Paper} sx={{ mb: 4 }}>
//           <Table>
//             <TableHead>
//               <TableRow>
//                 {data[0]?.map((_, index) => (
//                   <TableCell key={index}>
//                     {index === 0 ? '' : `Column ${index}`}
//                   </TableCell>
//                 ))}
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {data.map((row, rowIndex) => (
//                 <TableRow key={rowIndex}>
//                   {row.map((cell, cellIndex) => (
//                     <TableCell key={cellIndex}>
//                       {cellIndex === 0 ? (
//                         cell
//                       ) : (
//                         <TextField
//                           value={cell}
//                           onChange={(e) => handleInputChange(rowIndex, cellIndex, e.target.value)}
//                           variant="standard"
//                           fullWidth
//                         />
//                       )}
//                     </TableCell>
//                   ))}
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </TableContainer>

//         <Paper sx={{ p: 2, mb: 4 }}>
//           <Typography variant="h6" gutterBottom>
//             Histogram
//           </Typography>
//           {histogramData.length > 0 ? (
//             <ResponsiveContainer width="100%" height={300}>
//               <RechartsBarChart data={histogramData}>
//                 <XAxis dataKey="name" />
//                 <YAxis />
//                 <Tooltip />
//                 <Legend />
//                 <Bar dataKey="value" fill="#1976d2" />
//               </RechartsBarChart>
//             </ResponsiveContainer>
//           ) : (
//             <Typography color="text.secondary">No data available for histogram</Typography>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" gutterBottom>
//             Calculations
//           </Typography>
//           <Typography>Mean: {calculations.mean !== null ? calculations.mean.toFixed(2) : 'N/A'}</Typography>
//           <Typography>Median: {calculations.median !== null ? calculations.median.toFixed(2) : 'N/A'}</Typography>
//           <Typography>Mode: {calculations.mode !== null ? calculations.mode : 'N/A'}</Typography>
//         </Paper>
//       </Box>
//     </Box>
//   );
// };

// export default DataAnalysisApp;