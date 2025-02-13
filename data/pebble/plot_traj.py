import numpy as np
import matplotlib.pyplot as plt
import argparse
import sys

def read_block(lines, start_idx):
    """
    Lit un bloc de données à partir de l'index donné.
    Retourne le bloc de données et l'index de la ligne suivant le bloc.
    """
    # Lecture de la première ligne du bloc qui contient le nombre de contacts
    header = lines[start_idx].split()
    n_contacts = int(header[-1])
    
    # Skip la deuxième ligne (informations non utilisées)
    current_idx = start_idx + 2
    
    # Lecture des contacts
    contacts = []
    for i in range(n_contacts):
        line = lines[current_idx + i].split()
        contact = {
            'particle': int(line[1]),
            'x': float(line[2]),
            'y': float(line[3]),
            'z': float(line[4])
        }
        contacts.append(contact)
    
    return contacts, current_idx + n_contacts

def cartesian_to_spherical(x, y, z):
    """
    Convertit les coordonnées cartésiennes en coordonnées sphériques.
    Retourne (azimuth, colatitude) en radians.
    """
    r = np.sqrt(x*x + y*y + z*z)
    if r == 0:
        return 0, 0
        
    # Colatitude (theta) : angle avec l'axe z
    colatitude = np.arccos(z/r)
    
    # Azimuth (phi) : angle dans le plan x-y
    azimuth = np.arctan2(y, x)
    
    # Convertir en degrés
    return np.degrees(azimuth), np.degrees(colatitude)

def find_persistent_contacts(contacts1, contacts2):
    """
    Identifie les contacts qui persistent entre deux états successifs.
    Retourne une liste de paires de contacts.
    """
    persistent = []
    
    # Pour chaque contact dans le premier état
    for c1 in contacts1:
        # Cherche le même numéro de particule dans le deuxième état
        for c2 in contacts2:
            if c1['particle'] == c2['particle']:
                persistent.append((c1, c2))
                break
    
    return persistent

def plot_all_trajectories(all_persistent_contacts):
    """
    Trace toutes les trajectoires des contacts persistants dans un graphique 2D.
    """
    fig, ax = plt.subplots(figsize=(10, 8))
    
    n_steps = len(all_persistent_contacts)
    
    # Pour chaque paire d'états successifs
    for time_step, persistent_contacts in enumerate(all_persistent_contacts):
        # Calculer la couleur normalisée
        color = plt.cm.viridis(time_step / n_steps)
        
        for c1, c2 in persistent_contacts:
            # Conversion des coordonnées cartésiennes en sphériques
            az1, col1 = cartesian_to_spherical(c1['x'], c1['y'], c1['z'])
            az2, col2 = cartesian_to_spherical(c2['x'], c2['y'], c2['z'])
            
            # Ne pas tracer si le segment traverse la discontinuité ±180°
            if abs(az1 - az2) > 180:
                continue
            
            # Tracer le segment de trajectoire
            if time_step == 0 and c1 == persistent_contacts[0][0]:
                ax.plot([az1, az2], [col1, col2], '-', color=color, alpha=0.6,
                       marker='o', markersize=2, label='État initial')
            elif time_step == n_steps-1 and c1 == persistent_contacts[0][0]:
                ax.plot([az1, az2], [col1, col2], '-', color=color, alpha=0.6,
                       marker='o', markersize=2, label='État final')
            else:
                ax.plot([az1, az2], [col1, col2], '-', color=color, alpha=0.6,
                       marker='o', markersize=2)
    
    # Configuration du graphique
    ax.set_xlabel('Azimuth φ (degrés)')
    ax.set_ylabel('Colatitude θ (degrés)')
    ax.set_title('Trajectoires des contacts persistants')
    
    # Ajuster les limites pour l'azimuth de -180 à 180 degrés
    ax.set_xlim(-180, 180)
    # Ajuster les limites pour la colatitude de 0 à 180 degrés et inverser l'axe
    ax.set_ylim(180, 0)  # Inverser les limites pour orienter vers le bas
    
    # Ajouter une grille
    ax.grid(True, linestyle='--', alpha=0.6)
    
    # Ajouter une légende compacte
    ax.legend(loc='best', fontsize='small')
    
    plt.tight_layout()
    plt.show()
    
    # Configuration du graphique
    ax.set_xlabel('Azimuth φ (degrés)')
    ax.set_ylabel('Colatitude θ (degrés)')
    ax.set_title('Trajectoires des contacts persistants')
    
    # Ajuster les limites pour l'azimuth de -180 à 180 degrés
    ax.set_xlim(-180, 180)
    # Ajuster les limites pour la colatitude de 0 à 180 degrés et inverser l'axe
    ax.set_ylim(180, 0)  # Inverser les limites pour orienter vers le bas
    
    # Ajouter une grille
    ax.grid(True, linestyle='--', alpha=0.6)
    
    # Ajouter une légende compacte
    ax.legend(loc='best', fontsize='small')
    
    plt.tight_layout()
    plt.show()
    
    # Configuration du graphique
    ax.set_xlabel('Azimuth φ (degrés)')
    ax.set_ylabel('Colatitude θ (degrés)')
    ax.set_title('Trajectoires des contacts persistants')
    
    # Ajuster les limites pour l'azimuth de -180 à 180 degrés
    ax.set_xlim(-180, 180)
    # Ajuster les limites pour la colatitude de 0 à 180 degrés
    ax.set_ylim(0, 180)
    
    # Ajouter une grille
    ax.grid(True, linestyle='--', alpha=0.6)
    
    # Ajouter une légende compacte pour seulement 3 étapes
    ax.legend(loc='best', fontsize='small')
    
    plt.tight_layout()
    plt.show()

def analyze_file(filename):
    """
    Fonction principale qui analyse le fichier et trace les trajectoires.
    """
    try:
        with open(filename, 'r') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"Erreur : Le fichier '{filename}' n'existe pas.")
        sys.exit(1)
    except IOError:
        print(f"Erreur : Impossible de lire le fichier '{filename}'.")
        sys.exit(1)
        
    current_idx = 0
    previous_contacts = None
    all_persistent_contacts = []
    block_count = 0
    
    while current_idx < len(lines):
        # Ignorer les lignes vides
        if not lines[current_idx].strip():
            current_idx += 1
            continue
            
        # Lire le bloc courant
        try:
            contacts, next_idx = read_block(lines, current_idx)
            block_count += 1
            print(f"Bloc {block_count} lu : {len(contacts)} contacts")
            
            # Si nous avons deux états consécutifs
            if previous_contacts is not None:
                # Trouver les contacts persistants
                persistent = find_persistent_contacts(previous_contacts, contacts)
                print(f"Contacts persistants trouvés entre blocs {block_count-1} et {block_count}: {len(persistent)}")
                
                # Ajouter à la liste des contacts persistants
                if persistent:
                    all_persistent_contacts.append(persistent)
            
            # Préparer pour le prochain bloc
            previous_contacts = contacts
            current_idx = next_idx
            
        except Exception as e:
            print(f"Erreur lors de la lecture du bloc à l'index {current_idx}:")
            print(str(e))
            print(f"Contenu de la ligne problématique : {lines[current_idx]}")
            break
    
    print(f"\nRésumé :")
    print(f"Nombre total de blocs lus : {block_count}")
    print(f"Nombre de paires de blocs avec contacts persistants : {len(all_persistent_contacts)}")
    
    # Tracer toutes les trajectoires à la fin
    if all_persistent_contacts:
        print("\nCréation du graphique...")
        plot_all_trajectories(all_persistent_contacts)
        print("Graphique terminé.")
    else:
        print("Aucun contact persistant trouvé.")

def main():
    # Configuration du parser d'arguments
    parser = argparse.ArgumentParser(description='Analyse des contacts persistants entre particules.')
    parser.add_argument('filename', help='Nom du fichier de données à analyser')
    
    # Parsing des arguments
    args = parser.parse_args()
    
    # Analyse du fichier
    print(f"Analyse du fichier : {args.filename}")
    analyze_file(args.filename)

if __name__ == "__main__":
    main()
