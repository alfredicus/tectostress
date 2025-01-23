import sys

def parse_trajectory_file(filename):
   coords = []
   with open(filename, 'r') as f:
       next(f)
       for line in f:
           values = line.strip().split()
           if len(values) >= 3:
               x, y, z = map(float, values[:3])
               coords.append([x, y, z])
   return coords

if __name__ == '__main__':
   if len(sys.argv) != 2:
       print("Usage: python script.py <filename>")
       sys.exit(1)
       
   coords = parse_trajectory_file(sys.argv[1])
   print(coords)