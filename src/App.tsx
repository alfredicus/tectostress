import MainInterface from './components/MainInterface';
import { DataFactory } from '@alfredo-taboada/stress';

const App = () => {

    DataFactory.names().forEach(name => {
        const fields = DataFactory.fields(name)
        console.log(`Data Type: ${name}:`)
        console.log(`  Mandatory Fields: ${fields.mandatory.join(', ')}`)
        console.log(`  Optional Fields : ${fields.optional ? fields.optional.join(', ') : 'None'}`)
        console.log('-----------------------------------')
    });

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <MainInterface />
        </div>
    );
};

export default App;
