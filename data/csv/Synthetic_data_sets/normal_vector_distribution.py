#!/usr/bin/env python3
"""
SPHERE SAMPLING METHODS EDUCATIONAL DEMO
========================================

This script demonstrates 4 different methods for generating uniform random 
directions on a unit sphere, showing why some methods are biased and others uniform.

METHODS DEMONSTRATED:
1. Rejection Sampling (Uniform ✓)
2. Naive Spherical Coordinates (Biased ✗)  
3. Corrected Spherical Coordinates (Uniform ✓)
4. Marsaglia Method (Uniform ✓)

KEY INSIGHT: Uniform sphere sampling → Uniform Z-distribution!
This seems counterintuitive but follows from Archimedes' theorem:
Sphere surface area = Circumscribing cylinder lateral area

SETUP:
pip install matplotlib numpy

USAGE:
python3 sphere_sampling_demo.py
"""

import math
import random
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# Configuration
N_SAMPLES = 2000  # Number of points to generate for each method
RANDOM_SEED = 42  # For reproducible results (set to None for true randomness)

def method1_rejection_sampling(n_samples):
    """
    Method 1: Rejection Sampling
    """
    print("🎯 Method 1: Rejection Sampling")
    
    points = []
    attempts = 0
    
    while len(points) < n_samples:
        attempts += 1
        x = random.random() * 2 - 1
        y = random.random() * 2 - 1
        z = random.random() * 2 - 1
        
        radius_squared = x*x + y*y + z*z
        if radius_squared <= 1.0 and radius_squared > 0:
            radius = math.sqrt(radius_squared)
            points.append([x/radius, y/radius, z/radius])
    
    efficiency = len(points) / attempts * 100
    print(f"  Generated {len(points)} points in {attempts} attempts")
    print(f"  Efficiency: {efficiency:.1f}% (expected ~52%)")
    
    return points, efficiency

def method2_naive_spherical(n_samples):
    """
    Method 2: Naive Spherical Coordinates (BIASED!)
    """
    print("❌ Method 2: Naive Spherical Coordinates (BIASED)")
    
    points = []
    
    for _ in range(n_samples):
        theta = random.random() * 2 * math.pi
        phi = random.random() * math.pi  # WRONG - creates polar bias
        
        x = math.sin(phi) * math.cos(theta)
        y = math.sin(phi) * math.sin(theta)
        z = math.cos(phi)
        
        points.append([x, y, z])
    
    print(f"  Generated {len(points)} points")
    print(f"  ⚠️ WARNING: This method creates polar bias!")
    
    return points, 100.0

def method3_corrected_spherical(n_samples):
    """
    Method 3: Corrected Spherical Coordinates (UNIFORM)
    """
    print("✅ Method 3: Corrected Spherical Coordinates (UNIFORM)")
    
    points = []
    
    for _ in range(n_samples):
        theta = random.random() * 2 * math.pi
        u = random.random()
        phi = math.acos(1 - 2*u)  # CORRECTED
        
        x = math.sin(phi) * math.cos(theta)
        y = math.sin(phi) * math.sin(theta)
        z = math.cos(phi)
        
        points.append([x, y, z])
    
    print(f"  Generated {len(points)} points")
    print(f"  ✅ Uniform distribution using φ = arccos(1-2u)")
    
    return points, 100.0

def method4_marsaglia(n_samples):
    """
    Method 4: Marsaglia Method (UNIFORM)
    """
    print("🚀 Method 4: Marsaglia Method (UNIFORM)")
    
    points = []
    attempts = 0
    
    while len(points) < n_samples:
        attempts += 1
        s1 = random.random() * 2 - 1
        s2 = random.random() * 2 - 1
        
        sum_squares = s1*s1 + s2*s2
        if sum_squares <= 1.0:
            factor = 2 * math.sqrt(1 - sum_squares)
            x = s1 * factor
            y = s2 * factor
            z = 1 - 2 * sum_squares
            
            points.append([x, y, z])
    
    efficiency = len(points) / attempts * 100
    print(f"  Generated {len(points)} points in {attempts} attempts")
    print(f"  Efficiency: {efficiency:.1f}% (expected ~79%)")
    
    return points, efficiency

def create_simple_demo():
    """Create a simple demonstration without complex analysis"""
    
    if RANDOM_SEED is not None:
        random.seed(RANDOM_SEED)
        np.random.seed(RANDOM_SEED)
    
    print("="*60)
    print("🌐 SPHERE SAMPLING DEMONSTRATION")
    print("="*60)
    print("🎯 ARCHIMEDES' INSIGHT: Sphere area = Cylinder area")
    print("   This is why uniform sphere sampling → uniform Z!")
    print()
    
    # Generate points using all methods
    print("🔄 Generating points using different methods...\n")
    
    methods_data = []
    
    points1, eff1 = method1_rejection_sampling(N_SAMPLES)
    methods_data.append(("Rejection\n(Uniform ✓)", points1, eff1))
    
    points2, eff2 = method2_naive_spherical(N_SAMPLES)
    methods_data.append(("Naive Spherical\n(Biased ✗)", points2, eff2))
    
    points3, eff3 = method3_corrected_spherical(N_SAMPLES)
    methods_data.append(("Corrected Spherical\n(Uniform ✓)", points3, eff3))
    
    points4, eff4 = method4_marsaglia(N_SAMPLES)
    methods_data.append(("Marsaglia\n(Uniform ✓)", points4, eff4))
    
    # Create visualization
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    
    # Plot 3D distributions
    for i, (title, points, efficiency) in enumerate(methods_data):
        ax = fig.add_subplot(2, 4, i+1, projection='3d')
        
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        z_coords = [p[2] for p in points]
        
        colors = [(z + 1) / 2 for z in z_coords]
        
        ax.scatter(x_coords, y_coords, z_coords, c=colors, s=8, alpha=0.6, cmap='viridis')
        
        # Add wireframe sphere
        u = np.linspace(0, 2 * np.pi, 15)
        v = np.linspace(0, np.pi, 15)
        x_sphere = np.outer(np.cos(u), np.sin(v))
        y_sphere = np.outer(np.sin(u), np.sin(v))
        z_sphere = np.outer(np.ones(np.size(u)), np.cos(v))
        ax.plot_wireframe(x_sphere, y_sphere, z_sphere, alpha=0.1, color='gray')
        
        ax.set_title(f'{title}\nEff: {efficiency:.1f}%')
        ax.set_xlim([-1.2, 1.2])
        ax.set_ylim([-1.2, 1.2])
        ax.set_zlim([-1.2, 1.2])
    
    # Plot Z-distributions
    for i, (title, points, efficiency) in enumerate(methods_data):
        ax = axes[1, i]
        
        z_coords = [p[2] for p in points]
        
        ax.hist(z_coords, bins=20, alpha=0.7, edgecolor='black', density=True)
        ax.axhline(0.5, color='red', linestyle='--', linewidth=2, label='Expected uniform')
        
        ax.set_xlabel('Z Coordinate')
        ax.set_ylabel('Density')
        ax.set_title(f'Z-Distribution')
        ax.set_xlim([-1, 1])
        ax.grid(True, alpha=0.3)
        ax.legend()
        
        # Add explanation
        if 'Naive' in title:
            explanation = 'BIASED:\nPolar clustering'
            color = 'red'
        else:
            explanation = 'UNIFORM:\nFlat = correct!'
            color = 'green'
        
        ax.text(0.02, 0.98, explanation, transform=ax.transAxes, 
               verticalalignment='top', bbox=dict(boxstyle='round', facecolor=color, alpha=0.3))
    
    plt.tight_layout()
    
    print("\n🎨 Displaying visualization...")
    print("   • Top row: 3D point distributions")
    print("   • Bottom row: Z-coordinate histograms")
    print("   • Red line = expected UNIFORM Z (this is correct!)")
    print("   • Archimedes proved: sphere area = cylinder area")
    print("   • Therefore: uniform sphere → uniform Z projection!")
    
    try:
        plt.show()
        print("✅ Demo complete!")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n🎓 KEY TAKEAWAY:")
    print("   Your intuition about 'more points at poles' describes")
    print("   exactly the BIAS we want to eliminate!")
    print("   Uniform sphere sampling gives uniform Z - this is correct!")

if __name__ == "__main__":
    print(__doc__)
    create_simple_demo()
    print(f"\n🏁 Educational demo completed!")