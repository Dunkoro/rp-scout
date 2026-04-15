class SourceManager {
    constructor() {
        this.sources = [
            'r/roleplay',
            'r/roleplaying',
            'r/ropplaypartnersearch',
            'r/written_roleplay',
            'https://example.com/barbermonger-rss'
        ];
    }

    addSource(source) {
        if (!this.sources.includes(source)) {
            this.sources.push(source);
        }
    }

    removeSource(source) {
        this.sources = this.sources.filter(s => s !== source);
    }

    getAllSources() {
        return this.sources;
    }
}

export default SourceManager;
