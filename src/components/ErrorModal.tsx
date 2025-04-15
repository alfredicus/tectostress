import React from 'react';

interface ErrorModalProps {
  message: string;
  isOpen: boolean;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ message, isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(3px)'
    }}>
      <div className="modal-content" style={{ 
        padding: '24px', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '16px',
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: '16px'
        }}>
          <div style={{ 
            backgroundColor: '#ffebee', 
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: '12px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" 
                    stroke="#f44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 style={{ 
            margin: 0, 
            fontWeight: 600, 
            color: '#333',
            fontSize: '18px'
          }}>Error</h3>
        </div>
        
        <div style={{ marginBottom: '24px', color: '#555', lineHeight: '1.5' }}>
          {message}
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <button 
            onClick={onClose}
            style={{
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 3px 5px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1565c0';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#1976d2';
              e.currentTarget.style.boxShadow = '0 3px 5px rgba(0,0,0,0.1)';
            }}
          >
            Close
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ErrorModal;

// import React, { useState } from 'react';

// // Simple modal component
// const ErrorModal = ({ message, isOpen, onClose }: { message: string, isOpen: boolean, onClose: () => void }) => {
//     if (!isOpen) return null;

//     return (
//         <div className="modal-overlay" style={{
//             position: 'fixed',
//             top: 0,
//             left: 0,
//             right: 0,
//             bottom: 0,
//             backgroundColor: 'rgba(138, 136, 136, 0.5)',
//             display: 'flex',
//             justifyContent: 'center',
//             alignItems: 'center',
//             zIndex: 1000
//         }}>
//             <div className="modal-content" style={{
//                 padding: '20px',
//                 backgroundColor: 'white',
//                 borderRadius: '5px',
//                 maxWidth: '500px'
//             }}>
//                 <h3>Error</h3>
//                 <p>{message}</p>
//                 <button onClick={onClose}>Close</button>
//             </div>
//         </div>
//     );
// };

// export default ErrorModal