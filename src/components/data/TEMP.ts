const DATA_TYPE_CONFIGS = {
    stylolites: {
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['dip', 'strike', "dip direction"] },
        ],
        representations: [
            {
                name: 'poles',
                symbol: '✕',
                defaultColor: '#00ff00'
            },
            {
                name: 'planes',
                symbol: '──',
                defaultColor: '#00ff00'
            }
        ]
    }
}
