# Environnement Python
Pour créer un environnement Python afin de faire tourner `plot_traj.py`, vous avez plusieurs options. Voici la méthode la plus courante utilisant venv, qui est intégré à Python :

1. Ouvrez un terminal et naviguez vers le dossier où vous souhaitez créer votre projet
2. Créez l'environnement virtuel avec la commande :

```bash
python -m venv nom_environnement
```

3. Activez l'environnement :

- Sur Windows :

```bash
nom_environnement\Scripts\activate
```

- Sur macOS/Linux :

```bash
source nom_environnement/bin/activate
```

4. Une fois activé, vous pouvez installer les packages nécessaires avec pip :

```bash
pip install nom_du_package
```

5. Pour désactiver l'environnement quand vous avez terminé :

```bash
deactivate
```
