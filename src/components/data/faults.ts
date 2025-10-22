export const faults_synthetic = {
    name: 'Synthetic Faults',
    examples: {
        example1: {
            name: 'Example 1',
            csv: `id,type,strike,dip,Dip direction,Rake,Strike direction,Striation trend,Type of mouvement,Line trend,Line plunge,Deformation phase,Relative weight,Min friction angle,Max friction angle,Min angle,Max angle,Scale,Bedding-plane-strike,Bedding-plane-dip,Bedding-plane-dip-direction,x,y,z
11,Striated plane,75,70,S,0,N,,right lateral,,,,,,,,,,,,,,,
12,Striated plane,165,70,N,0,S,,left-lateral,,,,,,,,,,,,,,,
13,striated plane,30,30,SE,90,N,,Inverse,,,,,,,,,,,,,,,
18,Striated plane,75,40,E,0,N,,right-lateral,,,,,,,,,,,,,,,
19,Striated plane,165,40,W,0,S,,left-lateral,,,,,,,,,,,,,,,
20,Striated plane,75,30,W,0,N,,right-lateral,,,,,,,,,,,,,,,
21,Striated plane,165,30,E,0,S,,left-lateral,,,,,,,,,,,,,,,`
        }
    }
}   