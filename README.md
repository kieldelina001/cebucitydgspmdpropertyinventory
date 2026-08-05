# 🏢 Real Estate Inventory Management System

A modern, web-based Real Estate Inventory Management System designed for the **Property Management Division (PMD)**. This application streams data directly from **Google Sheets**, allowing real-time monitoring, searching, reporting, and updating of government property records.

---

# 📖 Overview

The Real Estate Inventory Management System provides a centralized dashboard for managing government real estate assets.

Instead of maintaining standalone spreadsheets, this system connects directly to Google Sheets, providing a live database that can be viewed and updated from any device with internet access.

Designed specifically for:

- Property Management Division
- Government Asset Inventory
- Real Estate Monitoring
- Building & Land Inventory
- Infrastructure Tracking

---

# ✨ Features

## 🔐 Secure Login

- Username & Password authentication
- Protected inventory dashboard
- Prevents unauthorized access

---

## 📡 Live Google Sheets Integration

- Real-time data synchronization
- No manual imports required
- Automatically loads the latest spreadsheet data
- Google Apps Script backend

---

## 📊 Interactive Dashboard

Displays live statistics including:

- Total Properties
- Existing Assets
- Not Found Assets
- For Verification
- Properties with Photos
- Tax Declarations Available

---

## 🏗 Property Type Dashboard

Automatically counts:

- Buildings
- Building Modifications
- School Buildings
- Hospitals
- Markets
- Roads
- Flood Control Structures
- Water Supply Systems
- Parks & Plazas
- Land
- Other Land Improvements
- Other Structures
- Other Infrastructure
- Slaughterhouses

---

## 🔍 Advanced Search

Search across the entire inventory instantly.

Supports:

- Keyword Search
- Property Type Filter
- Remarks Filter
- Media Filter

---

## 🖼 Image Gallery

Each property may contain:

- Photo 1
- Photo 2
- Map Coordinates
- Tax Declaration
- Transfer Certificate Page 1
- Transfer Certificate Page 2

Features include:

- Hover Preview
- Full Screen Viewer
- Multiple Photo Navigation
- Image Carousel

---

## 📄 Property Details Window

Clicking a property opens a detailed information panel.

Includes:

- Description
- Acquisition Date
- Unit Value
- Remarks
- Type
- Attached Documents
- Image Gallery

---

## ✏ Edit & Update Records

Authorized users can:

- Update Remarks
- Log Operator Name
- Save changes
- Automatically publish updates through Google Apps Script

Every update records:

- Updated By
- Last Update Timestamp

---

## 📤 Export Options

Export entire inventory as:

- CSV

Export filtered search results as:

- Printable HTML
- PDF (using browser Print)

---

## 📑 Pagination

Large inventories are automatically divided into pages for better performance.

- Previous / Next Navigation
- Page Counter

---

## 📱 Responsive Design

Optimized for:

- Desktop
- Tablets
- Mobile Phones

---

## ⬆ Back To Top Button

Floating quick navigation button for large datasets.

---

# 🖥 Built With

### Frontend

- HTML5
- CSS3
- JavaScript (Vanilla)

### Libraries

- PapaParse

### Backend

- Google Apps Script

### Database

- Google Sheets

### Storage

- Google Drive

---

# 📂 Project Structure

```
RealEstateInventory/
│
├── index.html
├── script.js
├── README.md
│
├── assets/
│   ├── dgs_logo.png
│   ├── Ph_seal_cebucity.png
│   ├── building.png
│   ├── road.png
│   ├── land.png
│   └── ...
```

---

# 🚀 How It Works

```
Google Sheets
       │
       ▼
Google Apps Script
       │
       ▼
Real Estate Inventory Web App
       │
       ▼
Search • Dashboard • Reports • Updates
```

---

# 🔄 Workflow

1. User logs in
2. Application connects to Google Sheets
3. Inventory is downloaded
4. Dashboard statistics are calculated
5. User searches or filters properties
6. User opens a property
7. User edits remarks
8. Changes are submitted through Google Apps Script
9. Google Sheet updates automatically

---

# 📈 Dashboard Metrics

The dashboard automatically calculates:

- Total Inventory
- Existing
- Not Found
- For Verification
- With Photos
- Tax Declarations
- Property Type Counts

No manual computation required.

---

# 📸 Media Support

Supports multiple media attachments per property:

- Property Images
- Maps
- Tax Declaration
- Transfer Certificate Pages

Images include:

- Hover Preview
- Enlarged Viewer
- Previous/Next Navigation

---

# 🔍 Search Capabilities

Searches all property information including:

- Article Number
- Description
- Remarks
- Property Type
- Dates
- Values

Additional filters:

- Remarks
- Property Type
- Media Availability

---

# 📦 Export Features

### Export All

Downloads the complete inventory in CSV format.

### Export Search Results

Generates a printable HTML report suitable for:

- Printing
- PDF Export
- Sharing

---

# ⚡ Performance Features

- Dynamic Loading Screen
- Live Connection Status
- Client-side Filtering
- Pagination
- Lightweight Vanilla JavaScript
- Responsive Layout
- Optimized Image Loading

---

# 🔒 Security

- Login Screen
- Controlled Editing
- Change Logging
- User Identification
- Timestamp Tracking

> **Note:** The current login credentials are stored in the frontend for development purposes. For production deployments, authentication should be moved to a secure backend service.

---

# 📌 Future Improvements

- User Roles
- Administrator Dashboard
- Audit Logs
- QR Code Property Labels
- GIS Mapping
- GPS Integration
- Multiple User Accounts
- Dark Mode
- Offline Mode
- Analytics Dashboard
- Email Notifications
- Asset History Tracking

---

# 👨‍💻 Author

**Noel Rie N. Deliña**

Property Management Division

---

# 📄 License

This project is intended for educational and government inventory management purposes.

Feel free to modify and improve it according to your organization's needs.

---

## ⭐ If you find this project useful

Please consider giving the repository a ⭐ on GitHub.

It helps others discover the project and supports future development.
