
const ReactWindow = require('react-window');
console.log('ReactWindow Keys:', Object.keys(ReactWindow));
console.log('ReactWindow.VariableSizeList:', ReactWindow.VariableSizeList);
console.log('ReactWindow.FixedSizeList:', ReactWindow.FixedSizeList);

try {
    const AutoSizerPkg = require('react-virtualized-auto-sizer');
    console.log('AutoSizerPkg Keys:', Object.keys(AutoSizerPkg));
} catch (e) {
    console.log('AutoSizer Error:', e.message);
}
