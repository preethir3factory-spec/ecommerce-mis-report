# R3 Factory - E-commerce MIS Report Extension

A Chrome extension for tracking and analyzing sales data from Amazon and Noon marketplaces.

![R3 Factory Logo](logo.jpg)

## Features

- 📊 **Multi-Platform Support**: Amazon & Noon
- 📅 **Date Filtering**: Today, Yesterday, All Time views
- 📈 **Real-time Metrics**: Sales, Costs, Margins, Returns
- 📁 **CSV/Excel Import**: Upload your sales data
- 🔄 **Live API Integration**: Connect to Amazon SP-API
- 📥 **Export Reports**: Download aggregated data

## Installation

### For Developers (Local Installation)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/r3-factory-mis-report.git
   cd r3-factory-mis-report
   ```

2. **Install server dependencies** (for Amazon API integration):
   ```bash
   cd server
   npm install
   ```

3. **Configure environment variables**:
   - Copy `server/.env.example` to `server/.env`
   - Add your Amazon SP-API credentials

4. **Load the extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `e-commerce-mis-report` folder

5. **Start the local server** (optional, for live Amazon data):
   ```bash
   cd server
   node server.js
   ```

### For End Users

**Option 1: Chrome Web Store** (Recommended)
- [Install from Chrome Web Store](#) *(Coming Soon)*

**Option 2: Manual Installation**
1. Download the latest release from [Releases](https://github.com/YOUR_USERNAME/r3-factory-mis-report/releases)
2. Extract the ZIP file
3. Follow steps 4-5 from "For Developers" above

## Usage

### Uploading Data

1. Click the extension icon in Chrome
2. Click the **Upload** button (↑ icon)
3. Select your CSV or Excel file
4. Supported formats:
   - **Standard Format**: `Date, Platform, Sales, Cost, Fees, Returns, Units Sold`
   - **Amazon Date Range Report**
   - **Noon Orders Export**

### Viewing Reports

- **Platform Tabs**: Switch between All, Amazon, or Noon
- **Date Filters**: View Today, Yesterday, or All Time data
- **Metrics**: See Sales, Margin, Costs, Fees, Returns, and Inventory

### Connecting Live Amazon Data

1. Click the **Settings** icon (⚙️)
2. Enter your Amazon SP-API credentials:
   - Refresh Token
   - Client ID
   - Client Secret
   - Marketplace (UAE/KSA/Egypt)
3. Click "Save & Sync"
4. Ensure the local server is running (`node server.js`)

## CSV Templates

See [CSV_DATA_TEMPLATES.md](CSV_DATA_TEMPLATES.md) for detailed format specifications.

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **APIs**: Amazon SP-API
- **Storage**: Chrome Local Storage

## Brand Guidelines

- **Primary Color**: Pantone 361 C (`#43B02A`)
- **Secondary Color**: Pantone 447 C (`#373A36`)
- **Font**: Avenir

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

⚠️ **Never commit sensitive data**:
- Do not commit `server/.env` (it's in `.gitignore`)
- Do not share your API credentials publicly
- Use environment variables for all secrets

## License

This project is proprietary software owned by R3 Factory.

## Support

For issues or questions:
- Open an [Issue](https://github.com/YOUR_USERNAME/r3-factory-mis-report/issues)
- Contact: support@r3factory.com

---

**R3 Factory** - Empowering E-commerce Analytics
