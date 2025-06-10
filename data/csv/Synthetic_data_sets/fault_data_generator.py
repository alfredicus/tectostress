#!/usr/bin/env python3
"""
GEOLOGICAL STRESS ANALYSIS TOOL
===============================

This script performs stress analysis on fault planes using uniform sphere sampling.
It solves the direct problem: given a stress tensor, find striae orientations on fault planes.

GEOLOGICAL COORDINATE SYSTEM:
- X-axis: East
- Y-axis: North  
- Z-axis: Up (vertical)

STRESS TENSOR CONVENTION:
- Compressive stress: negative values
- Extensional stress: positive values
- σ1 ≥ σ2 ≥ σ3 (principal stresses)

INSTALLATION & SETUP:
===================

# 1. Open terminal and navigate to your project directory
cd /path/to/your/project

# 2. Create virtual environment (ONLY NEEDED ONCE)
python3 -m venv venv

# 3. Activate virtual environment (NEEDED EVERY TIME you open a new terminal)
source venv/bin/activate

# 4. Install required packages (ONLY NEEDED ONCE after creating venv)
pip install matplotlib numpy pandas

# 5. Run the script (use the actual filename you saved)
python3 geological_stress_analysis.py

DEACTIVATE ENVIRONMENT WHEN DONE:
deactivate

USAGE:
python3 geological_stress_analysis.py

NOTE: Make sure the filename matches what you actually saved the script as!
"""

import math
import random
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# Configuration
N_FAULT_PLANES = 50  # Number of fault planes to generate
RANDOM_SEED = 42     # For reproducible results

class StressTensor:
    """Class to handle stress tensor operations"""
    
    def __init__(self, sigma1_azimuth, sigma1_dip, sigma3_azimuth, sigma3_dip, is_andersonian, R):
        """
        Initialize stress tensor
        
        Parameters:
        - sigma1_azimuth: Azimuth of σ1 (degrees, clockwise from North)
        - sigma1_dip: Dip angle of σ1 (degrees, from horizontal downward)
        - sigma3_azimuth: Azimuth of σ3 (degrees, clockwise from North)
        - sigma3_dip: Dip angle of σ3 (degrees, from horizontal downward)
        - is_andersonian: True if both σ1 and σ3 are horizontal (Andersonian regime)
        - R: Stress ratio (0 ≤ R ≤ 1)
        """
        self.sigma1_azimuth = sigma1_azimuth
        self.sigma1_dip = sigma1_dip
        self.sigma3_azimuth = sigma3_azimuth
        self.sigma3_dip = sigma3_dip
        self.is_andersonian = is_andersonian
        self.R = R
        
        # Calculate principal stress directions
        self._calculate_principal_directions()
        
        # Calculate stress tensor matrix
        self._calculate_stress_tensor()
    
    def _calculate_principal_directions(self):
        """Calculate unit vectors for principal stress directions"""
        
        # Convert to radians
        phi1 = math.radians(self.sigma1_azimuth)
        dip1 = math.radians(self.sigma1_dip)
        phi3 = math.radians(self.sigma3_azimuth)
        dip3 = math.radians(self.sigma3_dip)
        
        # σ1 direction (X=E, Y=N, Z=Up, dip measured downward from horizontal)
        self.sigma1_vector = np.array([
            math.sin(dip1) * math.sin(phi1),   # East component
            math.sin(dip1) * math.cos(phi1),   # North component
            -math.cos(dip1)                    # Up component (negative for downward dip)
        ])
        
        # σ3 direction
        self.sigma3_vector = np.array([
            math.sin(dip3) * math.sin(phi3),   # East component
            math.sin(dip3) * math.cos(phi3),   # North component
            -math.cos(dip3)                    # Up component (negative for downward dip)
        ])
        
        # Handle Andersonian regime (both σ1 and σ3 horizontal)
        if self.is_andersonian:
            # σ2 must be vertical (pointing downward by convention)
            self.sigma2_vector = np.array([0, 0, -1])  # Vertical downward
            self.sigma2_azimuth = 0  # Arbitrary for vertical axis
            self.sigma2_dip = 90.0   # Vertical
            
            print("   → Andersonian regime: σ2 set to vertical (dip=90°)")
            
        else:
            # σ2 is perpendicular to both σ1 and σ3 (cross product)
            self.sigma2_vector = np.cross(self.sigma3_vector, self.sigma1_vector)
            
            # Ensure it's normalized
            norm = np.linalg.norm(self.sigma2_vector)
            if norm > 1e-10:
                self.sigma2_vector = self.sigma2_vector / norm
            else:
                # Vectors are parallel or antiparallel - this shouldn't happen for valid input
                print("   ⚠️ Warning: σ1 and σ3 are parallel - setting σ2 to vertical")
                self.sigma2_vector = np.array([0, 0, -1])
        
        # Verify orthogonality
        dot12 = np.dot(self.sigma1_vector, self.sigma2_vector)
        dot13 = np.dot(self.sigma1_vector, self.sigma3_vector)
        dot23 = np.dot(self.sigma2_vector, self.sigma3_vector)
        
        if max(abs(dot12), abs(dot13), abs(dot23)) > 1e-6:
            print(f"   ⚠️ Warning: Principal axes not orthogonal (max dot product: {max(abs(dot12), abs(dot13), abs(dot23)):.6f})")
        
        # Calculate azimuth and dip for all axes
        self._calculate_spherical_coords()
    
    def _calculate_spherical_coords(self):
        """Calculate spherical coordinates for all principal axes"""
        
        self.principal_axes = {}
        
        # For σ1, use input values
        self.principal_axes['σ1'] = {
            'vector': self.sigma1_vector,
            'azimuth': self.sigma1_azimuth,
            'dip': self.sigma1_dip
        }
        
        # For σ3, use input values
        self.principal_axes['σ3'] = {
            'vector': self.sigma3_vector,
            'azimuth': self.sigma3_azimuth,
            'dip': self.sigma3_dip
        }
        
        # For σ2, calculate from vector
        vector = self.sigma2_vector.copy()
        
        # Calculate azimuth and dip from vector components
        if self.is_andersonian:
            # σ2 is vertical in Andersonian regime
            azimuth = 0  # Arbitrary for vertical axis
            dip = 90.0   # Vertical
        else:
            # Calculate azimuth (clockwise from North)
            if abs(vector[0]) < 1e-10 and abs(vector[1]) < 1e-10:
                # Vertical vector
                azimuth = 0  # Arbitrary
                dip = 90.0 if vector[2] < 0 else 90.0  # Always positive dip
            else:
                azimuth = math.degrees(math.atan2(vector[0], vector[1]))
                if azimuth < 0:
                    azimuth += 360
                
                # Ensure vector points into lower hemisphere for dip calculation
                if vector[2] > 0:
                    vector = -vector
                    azimuth = (azimuth + 180) % 360
                
                # Calculate dip angle (from horizontal downward)
                horizontal_magnitude = math.sqrt(vector[0]**2 + vector[1]**2)
                if horizontal_magnitude > 1e-10:
                    dip = math.degrees(math.atan2(abs(vector[2]), horizontal_magnitude))
                else:
                    dip = 90.0  # Vertical
        
        self.principal_axes['σ2'] = {
            'vector': self.sigma2_vector,
            'azimuth': azimuth,
            'dip': dip
        }
    
    def _calculate_stress_tensor(self):
        """Calculate the stress tensor matrix"""
        
        # Principal stress magnitudes
        sigma1_mag = -1.0  # Compression
        sigma2_mag = -self.R
        sigma3_mag = 0.0   # Extension
        
        # Create principal stress matrix in principal coordinates
        S_principal = np.diag([sigma1_mag, sigma2_mag, sigma3_mag])
        
        # Rotation matrix from principal to geographic coordinates
        # Each column is a principal stress direction
        R_matrix = np.column_stack([
            self.sigma1_vector,
            self.sigma2_vector, 
            self.sigma3_vector
        ])
        
        # Transform to geographic coordinates: S = R * S_principal * R^T
        self.stress_tensor = R_matrix @ S_principal @ R_matrix.T
        
    def get_stress_on_plane(self, normal_vector):
        """
        Calculate stress components on a fault plane
        
        Parameters:
        - normal_vector: Unit normal vector to the fault plane
        
        Returns:
        - total_stress: Total stress vector on the plane
        - normal_stress: Normal stress magnitude (scalar)
        - shear_stress: Shear stress vector
        - shear_magnitude: Magnitude of shear stress
        """
        
        # Total stress vector on the plane
        total_stress = self.stress_tensor @ normal_vector
        
        # Normal stress (scalar projection)
        normal_stress_scalar = np.dot(normal_vector, total_stress)
        normal_stress_vector = normal_stress_scalar * normal_vector
        
        # Shear stress vector
        shear_stress = total_stress - normal_stress_vector
        shear_magnitude = np.linalg.norm(shear_stress)
        
        return total_stress, normal_stress_scalar, shear_stress, shear_magnitude

def generate_fault_normals_upper_hemisphere(n_planes):
    """Generate random unit vectors in upper hemisphere using corrected spherical coordinates"""
    
    fault_normals = []
    
    for _ in range(n_planes):
        # Generate uniform random direction in upper hemisphere
        theta = random.random() * 2 * math.pi  # Azimuth
        u = random.random() * 0.5 + 0.5  # Restrict to upper hemisphere (z > 0)
        phi = math.acos(1 - 2*u)  # Corrected colatitude
        
        # Convert to Cartesian coordinates
        x = math.sin(phi) * math.cos(theta)
        y = math.sin(phi) * math.sin(theta)
        z = math.cos(phi)
        
        fault_normals.append(np.array([x, y, z]))
    
    return fault_normals

def vector_to_geological_notation(normal_vector):
    """
    Convert fault normal vector to geological notation
    
    Returns:
    - azimuth: Azimuth of horizontal vector (degrees)
    - dip: Dip angle (degrees)
    - dip_direction: Direction of dip (N, S, E, W)
    """
    
    # Ensure normal points upward
    if normal_vector[2] < 0:
        normal_vector = -normal_vector
    
    # Calculate dip angle (angle from horizontal)
    dip = math.degrees(math.acos(normal_vector[2]))
    
    # Calculate azimuth of dip direction
    dip_azimuth = math.degrees(math.atan2(normal_vector[0], normal_vector[1]))
    if dip_azimuth < 0:
        dip_azimuth += 360
    
    # Determine dip direction
    if 315 <= dip_azimuth or dip_azimuth < 45:
        dip_direction = 'N'
    elif 45 <= dip_azimuth < 135:
        dip_direction = 'E'
    elif 135 <= dip_azimuth < 225:
        dip_direction = 'S'
    else:
        dip_direction = 'W'
    
    # Azimuth of horizontal vector (perpendicular to dip direction)
    azimuth = (dip_azimuth + 90) % 360
    
    return azimuth, dip, dip_direction

def calculate_rake_and_movement(normal_vector, shear_stress, azimuth):
    """
    Calculate rake angle and sense of movement using geological conventions
    
    Parameters:
    - normal_vector: Fault plane normal
    - shear_stress: Shear stress vector
    - azimuth: Azimuth of fault plane
    
    Returns:
    - rake: Rake angle (0-90 degrees, acute angle)
    - movement: Sense of movement (I, N, RL, LL)
    - striation_azimuth: Azimuth from which rake is measured
    """
    
    if np.linalg.norm(shear_stress) == 0:
        return 0, 'N', azimuth
    
    # Normalize shear stress to get striation direction
    striation = shear_stress / np.linalg.norm(shear_stress)
    
    # Project striation onto horizontal plane to get trend
    striation_horizontal = np.array([striation[0], striation[1], 0])
    striation_horizontal_norm = np.linalg.norm(striation_horizontal)
    
    if striation_horizontal_norm > 1e-10:
        striation_horizontal = striation_horizontal / striation_horizontal_norm
        
        # Calculate striation azimuth (geological convention: clockwise from North)
        striation_azimuth = math.degrees(math.atan2(striation_horizontal[0], striation_horizontal[1]))
        if striation_azimuth < 0:
            striation_azimuth += 360
    else:
        # Pure vertical movement
        striation_azimuth = azimuth
    
    # Calculate azimuth vector (horizontal vector on fault plane)
    azimuth_rad = math.radians(azimuth)
    azimuth_vector = np.array([
        math.sin(azimuth_rad),  # East component
        math.cos(azimuth_rad),  # North component
        0                       # Horizontal
    ])
    
    # Calculate rake angle between azimuth direction and striation
    # Project striation onto fault plane first
    striation_on_plane = striation - np.dot(striation, normal_vector) * normal_vector
    striation_on_plane_norm = np.linalg.norm(striation_on_plane)
    
    if striation_on_plane_norm > 1e-10:
        striation_on_plane = striation_on_plane / striation_on_plane_norm
        
        # Calculate angle between azimuth and striation on the plane
        cos_rake = np.dot(azimuth_vector, striation_on_plane)
        
        # Ensure rake is acute (0-90°)
        rake = math.degrees(math.acos(abs(cos_rake)))
        
        # Choose reference azimuth (fault plane has two opposite azimuths)
        # Use the one that gives the smaller rake angle for geological convention
        opposite_azimuth = (azimuth + 180) % 360
        opposite_azimuth_rad = math.radians(opposite_azimuth)
        opposite_azimuth_vector = np.array([
            math.sin(opposite_azimuth_rad),
            math.cos(opposite_azimuth_rad), 
            0
        ])
        
        cos_rake_opposite = np.dot(opposite_azimuth_vector, striation_on_plane)
        rake_opposite = math.degrees(math.acos(abs(cos_rake_opposite)))
        
        # Use the reference that gives smaller rake
        if rake_opposite < rake:
            rake = rake_opposite
            reference_azimuth = opposite_azimuth
        else:
            reference_azimuth = azimuth
            
    else:
        rake = 0
        reference_azimuth = azimuth
    
    # Determine sense of movement
    movement_components = []
    
    # Vertical component (thrust/normal)
    if striation[2] > 0.1:
        movement_components.append('I')  # Inverse (thrust)
    elif striation[2] < -0.1:
        movement_components.append('N')  # Normal
    
    # Horizontal component (strike-slip)
    lateral_component = np.dot(azimuth_vector, striation)
    if abs(lateral_component) > 0.1:
        if lateral_component > 0:
            movement_components.append('LL')  # Left-lateral
        else:
            movement_components.append('RL')  # Right-lateral
    
    # Combine movement components
    if not movement_components:
        movement = 'N'
    else:
        movement = '+'.join(movement_components)
    
    return rake, movement, reference_azimuth

def validate_fault_plane_vectors(normal_vector, azimuth, dip):
    """
    Validate that fault plane vectors are correctly defined
    Check: normalized_dip_vector × normalized_azimuth_vector = normal_plane_vector
    
    Parameters:
    - normal_vector: Upward pointing normal to fault plane
    - azimuth: Azimuth of horizontal vector on plane
    - dip: Dip angle of the plane
    
    Returns:
    - is_valid: Boolean indicating if vectors are correctly defined
    - azimuth_vector: Horizontal vector on plane
    - dip_vector: Dip vector (downward)
    - computed_normal: Normal computed from cross product
    """
    
    # Convert angles to radians
    azimuth_rad = math.radians(azimuth)
    dip_rad = math.radians(dip)
    
    # Azimuth vector (horizontal, on the plane)
    azimuth_vector = np.array([
        math.sin(azimuth_rad),  # East component
        math.cos(azimuth_rad),  # North component
        0                       # Horizontal
    ])
    
    # Dip vector (points downward along steepest descent of plane)
    # This is perpendicular to azimuth vector and makes angle 'dip' with horizontal
    dip_azimuth = (azimuth + 90) % 360  # Perpendicular to azimuth
    dip_azimuth_rad = math.radians(dip_azimuth)
    
    dip_vector = np.array([
        math.sin(dip_rad) * math.sin(dip_azimuth_rad),  # East component
        math.sin(dip_rad) * math.cos(dip_azimuth_rad),  # North component
        -math.cos(dip_rad)                              # Downward component
    ])
    
    # Normalize vectors
    azimuth_vector = azimuth_vector / np.linalg.norm(azimuth_vector)
    dip_vector = dip_vector / np.linalg.norm(dip_vector)
    normal_vector = normal_vector / np.linalg.norm(normal_vector)
    
    # Compute normal from cross product (right-hand rule)
    # For geological convention: dip_vector × azimuth_vector = upward_normal
    computed_normal = np.cross(dip_vector, azimuth_vector)
    computed_normal = computed_normal / np.linalg.norm(computed_normal)
    
    # Check if computed normal matches given normal (within tolerance)
    dot_product = np.dot(computed_normal, normal_vector)
    is_valid = abs(abs(dot_product) - 1.0) < 1e-6  # Allow for both orientations
    
    return is_valid, azimuth_vector, dip_vector, computed_normal
    """
    Calculate rake angle and sense of movement
    
    Parameters:
    - normal_vector: Fault plane normal
    - shear_stress: Shear stress vector
    - azimuth: Azimuth of fault plane
    
    Returns:
    - rake: Rake angle (0-90 degrees)
    - movement: Sense of movement (I, N, RL, LL)
    """
    
    if np.linalg.norm(shear_stress) == 0:
        return 0, 'N'
    
    # Normalize shear stress to get striation direction
    striation = shear_stress / np.linalg.norm(shear_stress)
    
    # Calculate azimuth vector (horizontal vector on fault plane)
    azimuth_rad = math.radians(azimuth)
    azimuth_vector = np.array([
        math.sin(azimuth_rad),  # East component
        math.cos(azimuth_rad),  # North component
        0                       # Horizontal
    ])
    
    # Calculate rake angle
    cos_rake = np.dot(azimuth_vector, striation)
    rake = math.degrees(math.acos(abs(cos_rake)))
    
    # Determine sense of movement
    movement_components = []
    
    # Vertical component
    if striation[2] > 0.1:
        movement_components.append('I')  # Inverse (thrust)
    elif striation[2] < -0.1:
        movement_components.append('N')  # Normal
    
    # Horizontal component
    lateral_component = np.dot(azimuth_vector, striation)
    if abs(lateral_component) > 0.1:
        if lateral_component > 0:
            movement_components.append('LL')  # Left-lateral
        else:
            movement_components.append('RL')  # Right-lateral
    
    # Combine movement components
    if not movement_components:
        movement = 'N'
    else:
        movement = '+'.join(movement_components)
    
    return rake, movement

def draw_great_circle(ax, strike, dip, color='gray', alpha=0.3, linewidth=1):
    """
    Draw a great circle on stereographic projection (Wulff net)
    
    Parameters:
    - ax: matplotlib axis
    - strike: Strike azimuth (degrees)
    - dip: Dip angle (degrees)
    - color: Line color
    - alpha: Line transparency
    - linewidth: Line width
    """
    
    # Convert strike and dip to pole vector (normal to plane)
    strike_rad = math.radians(strike)
    dip_rad = math.radians(dip)
    
    # Calculate pole (normal vector pointing downward into lower hemisphere)
    pole = np.array([
        math.sin(dip_rad) * math.sin(strike_rad + math.pi/2),  # Perpendicular to strike
        math.sin(dip_rad) * math.cos(strike_rad + math.pi/2),
        -math.cos(dip_rad)  # Downward
    ])
    
    # Ensure pole points into lower hemisphere
    if pole[2] > 0:
        pole = -pole
    
    # Generate points on the great circle
    n_points = 100
    circle_points = []
    
    for i in range(n_points + 1):
        # Angle around the great circle
        theta = 2 * math.pi * i / n_points
        
        # Two vectors in the plane (perpendicular to pole)
        # First vector: horizontal direction along strike
        v1 = np.array([math.sin(strike_rad), math.cos(strike_rad), 0])
        
        # Second vector: down-dip direction
        v2 = np.array([
            -math.cos(dip_rad) * math.sin(strike_rad + math.pi/2),
            -math.cos(dip_rad) * math.cos(strike_rad + math.pi/2),
            -math.sin(dip_rad)
        ])
        
        # Point on great circle
        point = math.cos(theta) * v1 + math.sin(theta) * v2
        point = point / np.linalg.norm(point)  # Normalize to unit sphere
        
        # Project to lower hemisphere if necessary
        if point[2] > 0:
            point = -point
            
        # Stereographic projection
        if point[2] > -0.999:  # Avoid division by zero at south pole
            x_proj = point[0] / (1 + abs(point[2]))
            y_proj = point[1] / (1 + abs(point[2]))
            circle_points.append([x_proj, y_proj])
    
    if len(circle_points) > 2:
        circle_points = np.array(circle_points)
        ax.plot(circle_points[:, 0], circle_points[:, 1], 
                color=color, alpha=alpha, linewidth=linewidth)

def create_stereographic_projection(stress_tensor, fault_data):
    """Create stereographic projection plot with great circles"""
    
    fig, ax = plt.subplots(1, 1, figsize=(12, 12))
    
    # Draw stereonet circle
    circle = plt.Circle((0, 0), 1, fill=False, color='black', linewidth=2)
    ax.add_patch(circle)
    
    # Plot principal stress axes
    colors = {'σ1': 'red', 'σ2': 'green', 'σ3': 'blue'}
    markers = {'σ1': 'o', 'σ2': 's', 'σ3': '^'}
    
    for name, data in stress_tensor.principal_axes.items():
        vector = data['vector'].copy()
        
        # Project to lower hemisphere
        if vector[2] > 0:
            vector = -vector
            
        # Stereographic projection
        if abs(vector[2] + 1) > 1e-10:  # Avoid south pole
            x_proj = vector[0] / (1 - vector[2])
            y_proj = vector[1] / (1 - vector[2])
            
            ax.plot(x_proj, y_proj, marker=markers[name], color=colors[name], 
                   markersize=15, markeredgecolor='black', markeredgewidth=1,
                   label=f'{name} (Az:{data["azimuth"]:.0f}°, Dip:{data["dip"]:.0f}°)')
    
    # Plot fault planes as great circles
    for i, row in fault_data.iterrows():
        if i < 20:  # Limit number of great circles for clarity
            draw_great_circle(ax, row['Azimuth'], row['Dip'], 
                            color='gray', alpha=0.4, linewidth=0.8)
    
    # Plot fault poles as points
    for _, row in fault_data.iterrows():
        # Convert back to normal vector for plotting
        azimuth_rad = math.radians(row['Azimuth'])
        dip_rad = math.radians(row['Dip'])
        
        # Normal vector (pole to plane)
        normal = np.array([
            math.sin(dip_rad) * math.sin(azimuth_rad + math.pi/2),
            math.sin(dip_rad) * math.cos(azimuth_rad + math.pi/2),
            -math.cos(dip_rad)
        ])
        
        # Project to lower hemisphere
        if normal[2] > 0:
            normal = -normal
            
        # Stereographic projection
        if abs(normal[2] + 1) > 1e-10:
            x_proj = normal[0] / (1 - normal[2])
            y_proj = normal[1] / (1 - normal[2])
            
            ax.plot(x_proj, y_proj, '.', color='darkgray', markersize=3, alpha=0.7)
    
    # Add grid lines (simplified)
    for angle in range(0, 360, 30):
        # Meridians
        x_line = np.sin(np.radians(angle)) * np.linspace(0, 1, 20)
        y_line = np.cos(np.radians(angle)) * np.linspace(0, 1, 20)
        ax.plot(x_line, y_line, 'k-', alpha=0.1, linewidth=0.5)
    
    ax.set_xlim(-1.2, 1.2)
    ax.set_ylim(-1.2, 1.2)
    ax.set_aspect('equal')
    ax.grid(True, alpha=0.2)
    ax.legend(loc='upper left', bbox_to_anchor=(1.02, 1))
    ax.set_title('Stereographic Projection (Lower Hemisphere)\nWulff Net with Great Circles\n' +
                'Red=σ1, Green=σ2, Blue=σ3\nGray lines=Fault planes, Gray dots=Poles')
    
    # Add cardinal directions
    ax.text(0, 1.1, 'N', ha='center', va='center', fontsize=12, fontweight='bold')
    ax.text(1.1, 0, 'E', ha='center', va='center', fontsize=12, fontweight='bold')
    ax.text(0, -1.1, 'S', ha='center', va='center', fontsize=12, fontweight='bold')
    ax.text(-1.1, 0, 'W', ha='center', va='center', fontsize=12, fontweight='bold')
    
    plt.tight_layout()
    return fig

def get_user_input():
    """Get stress tensor parameters from user"""
    
    print("📊 Define the stress tensor parameters:")
    print("   Enter the following parameters (or press Enter for default values)")
    print("   Note: Andersonian regime - if both σ1 and σ3 are horizontal, σ2 will be vertical")
    
    # Get σ1 parameters
    try:
        sigma1_azimuth = input("   σ1 azimuth (degrees, clockwise from North) [default: 45]: ")
        sigma1_azimuth = float(sigma1_azimuth) if sigma1_azimuth.strip() else 45.0
    except ValueError:
        sigma1_azimuth = 45.0
    
    try:
        sigma1_dip = input("   σ1 dip angle (degrees, from horizontal downward) [default: 30]: ")
        sigma1_dip = float(sigma1_dip) if sigma1_dip.strip() else 30.0
    except ValueError:
        sigma1_dip = 30.0
    
    # Get σ3 parameters
    try:
        sigma3_azimuth = input("   σ3 azimuth (degrees, clockwise from North) [default: 315]: ")
        sigma3_azimuth = float(sigma3_azimuth) if sigma3_azimuth.strip() else 315.0
    except ValueError:
        sigma3_azimuth = 315.0
    
    try:
        sigma3_dip = input("   σ3 dip angle (degrees, from horizontal downward) [default: 0]: ")
        sigma3_dip = float(sigma3_dip) if sigma3_dip.strip() else 0.0
    except ValueError:
        sigma3_dip = 0.0
    
    # Check for Andersonian regime
    is_andersonian = (abs(sigma1_dip) < 1e-6 and abs(sigma3_dip) < 1e-6)
    if is_andersonian:
        print("   ⚠️ Andersonian regime detected: both σ1 and σ3 horizontal → σ2 will be vertical")
    
    # Get stress ratio R
    try:
        R = input("   R (stress ratio, 0 ≤ R ≤ 1) [default: 0.5]: ")
        R = float(R) if R.strip() else 0.5
        R = max(0.0, min(1.0, R))  # Clamp between 0 and 1
    except ValueError:
        R = 0.5
    
    return sigma1_azimuth, sigma1_dip, sigma3_azimuth, sigma3_dip, is_andersonian, R

def main():
    """Main function to run the geological stress analysis"""
    
    if RANDOM_SEED is not None:
        random.seed(RANDOM_SEED)
        np.random.seed(RANDOM_SEED)
    
    print("="*60)
    print("🪨 GEOLOGICAL STRESS ANALYSIS")
    print("="*60)
    
    # Get stress tensor parameters from user
    sigma1_azimuth, sigma1_dip, sigma3_azimuth, sigma3_dip, is_andersonian, R = get_user_input()
    
    print(f"\n📊 Using stress tensor parameters:")
    print(f"   σ1 azimuth: {sigma1_azimuth}° (clockwise from North)")
    print(f"   σ1 dip: {sigma1_dip}° (from horizontal downward)")
    print(f"   σ3 azimuth: {sigma3_azimuth}° (clockwise from North)")
    print(f"   σ3 dip: {sigma3_dip}° (from horizontal downward)")
    if is_andersonian:
        print(f"   ⚠️ Andersonian regime: σ2 will be vertical")
    print(f"   R (stress ratio): {R}")
    
    # Create stress tensor
    stress_tensor = StressTensor(sigma1_azimuth, sigma1_dip, sigma3_azimuth, sigma3_dip, is_andersonian, R)
    
    print(f"\n🎯 Principal stress axes (lower hemisphere projection):")
    for name, data in stress_tensor.principal_axes.items():
        print(f"   {name}: Azimuth={data['azimuth']:.1f}°, Dip={data['dip']:.1f}°")
    
    print(f"\n📐 Stress tensor matrix:")
    print(f"   [{stress_tensor.stress_tensor[0,0]:6.3f} {stress_tensor.stress_tensor[0,1]:6.3f} {stress_tensor.stress_tensor[0,2]:6.3f}]")
    print(f"   [{stress_tensor.stress_tensor[1,0]:6.3f} {stress_tensor.stress_tensor[1,1]:6.3f} {stress_tensor.stress_tensor[1,2]:6.3f}]")
    print(f"   [{stress_tensor.stress_tensor[2,0]:6.3f} {stress_tensor.stress_tensor[2,1]:6.3f} {stress_tensor.stress_tensor[2,2]:6.3f}]")
    
    # Generate fault planes
    print(f"\n🔄 Generating {N_FAULT_PLANES} fault planes...")
    fault_normals = generate_fault_normals_upper_hemisphere(N_FAULT_PLANES)
    
    # Analyze each fault plane
    fault_data = []
    validation_results = []
    
    for i, normal in enumerate(fault_normals):
        # Convert to geological notation
        azimuth, dip, dip_direction = vector_to_geological_notation(normal)
        
        # Validate fault plane vectors
        is_valid, azimuth_vec, dip_vec, computed_normal = validate_fault_plane_vectors(normal, azimuth, dip)
        validation_results.append(is_valid)
        
        # Calculate stress on plane
        total_stress, normal_stress, shear_stress, shear_magnitude = stress_tensor.get_stress_on_plane(normal)
        
        # Calculate rake and movement
        rake, movement, reference_azimuth = calculate_rake_and_movement(normal, shear_stress, azimuth)
        
        fault_data.append({
            'Plane': i + 1,
            'Azimuth': azimuth,
            'Dip': dip,
            'Dip_Direction': dip_direction,
            'Normal_Stress': normal_stress,
            'Shear_Stress': shear_magnitude,
            'Rake': rake,
            'Movement': movement,
            'Reference_Az': reference_azimuth,
            'Vector_Valid': is_valid
        })
    
    # Report validation results
    valid_count = sum(validation_results)
    print(f"\n✅ Vector validation: {valid_count}/{len(fault_normals)} planes correctly defined")
    if valid_count < len(fault_normals):
        invalid_planes = [i+1 for i, valid in enumerate(validation_results) if not valid]
        print(f"   ⚠️ Invalid planes: {invalid_planes[:10]}{'...' if len(invalid_planes) > 10 else ''}")
    
    # Create DataFrame
    df = pd.DataFrame(fault_data)
    
    # Save to CSV
    csv_filename = 'fault_analysis_results.csv'
    df.to_csv(csv_filename, index=False)
    print(f"💾 Results saved to {csv_filename}")
    
    # Display first few results
    print(f"\n📋 First 10 fault plane analyses:")
    print(df.head(10).to_string(index=False, float_format='%.2f'))
    
    # Create visualization
    print(f"\n🎨 Creating stereographic projection...")
    fig = create_stereographic_projection(stress_tensor, df)
    
    # Show statistics
    print(f"\n📊 Analysis Statistics:")
    print(f"   Normal stress range: {df['Normal_Stress'].min():.3f} to {df['Normal_Stress'].max():.3f}")
    print(f"   Shear stress range: {df['Shear_Stress'].min():.3f} to {df['Shear_Stress'].max():.3f}")
    print(f"   Average rake angle: {df['Rake'].mean():.1f}°")
    
    movement_counts = df['Movement'].value_counts()
    print(f"   Movement types:")
    for movement, count in movement_counts.items():
        print(f"      {movement}: {count} planes")
    
    try:
        plt.show()
        print("✅ Analysis complete!")
    except Exception as e:
        print(f"❌ Error displaying plot: {e}")
    
    print(f"\n🎓 KEY RESULTS:")
    print(f"   • Generated {len(fault_data)} fault planes with uniform distribution")
    print(f"   • Calculated striae orientations based on stress tensor")
    print(f"   • Results saved in geological notation format")
    print(f"   • Vector validation: dip_vector × azimuth_vector = normal_vector")
    print(f"   • Rake angles are acute (0-90°) measured from reference azimuth")
    print(f"   • Great circles show fault planes on Wulff stereonet")
    print(f"   • All angles are in degrees: azimuth (clockwise from N), dip (from horizontal)")
    if is_andersonian:
        print(f"   • Andersonian regime: both σ1 and σ3 horizontal, σ2 vertical")
    print(f"   • Principal stress markers: σ1=circle, σ2=square, σ3=triangle")

if __name__ == "__main__":
    main()