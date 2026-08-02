# QA Job Hunter - Sanity and Feature Test Checklist

This document outlines the key sanity and feature tests for the QA Job Hunter application, covering critical functionalities.

## 1. Scraping (LinkedIn)

### Sanity Tests
- [ ] Verify successful login to LinkedIn.
- [ ] Verify job search functionality returns results.
- [ ] Verify basic job posting data is extracted (title, company, location).

### Feature Tests
- [ ] **Advanced Search Filters**: Test various combinations of search filters (e.g., experience level, job type, date posted).
- [ ] **Data Extraction Accuracy**: Verify all expected fields are correctly extracted (description, requirements, apply link).
- [ ] **Pagination Handling**: Test scraping across multiple pages of search results.
- [ ] **Error Handling (LinkedIn)**: Simulate scenarios like CAPTCHAs, rate limits, or blocked accounts and verify appropriate handling/notifications.
- [ ] **New Job Detection**: Verify that newly posted jobs are identified and scraped.

## 2. Matching (Cálculo de %, MatchedSkills, Gaps)

### Sanity Tests
- [ ] Verify basic percentage calculation for a simple job and CV.
- [ ] Verify `matchedSkills` are identified.
- [ ] Verify `gaps` are identified.

### Feature Tests
- [ ] **Percentage Calculation Accuracy**: Test with various CVs and job descriptions to ensure accurate percentage matching.
- [ ] **Skill Matching (Exact & Partial)**: Verify both exact and partial skill matches are correctly identified.
- [ ] **Gap Analysis**: Ensure missing skills are accurately identified as gaps.
- [ ] **Keyword Weighting**: If applicable, test if certain keywords/skills are weighted higher in the matching algorithm.
- [ ] **CV Variations**: Test with different CV formats (e.g., long, short, different sections).
- [ ] **Job Description Variations**: Test with diverse job descriptions from various industries.

## 3. Dashboard (Carga de datos, Filtros, Ordenamiento, Detalle, Banner, Feedback)

### Sanity Tests
- [ ] Verify dashboard loads without errors.
- [ ] Verify job data is displayed in the main table.
- [ ] Verify basic filtering by "Enviada" status works.

### Feature Tests
- [ ] **Data Loading & Display**:
    - [ ] Verify all scraped data is correctly populated in the dashboard.
    - [ ] Test performance with a large number of job entries.
- [ ] **Filters**:
    - [ ] **Status Filters**: Test all status filters (e.g., "Enviada", "Descartado", "Pendiente", "Stand-by").
    - [ ] **Company Filter**: Verify filtering by company name.
    - [ ] **Position Filter**: Verify filtering by job title/position.
    - [ ] **Combined Filters**: Test multiple filters simultaneously.
- [ ] **Sorting**:
    - [ ] Test sorting by date (ascending/descending).
    - [ ] Test sorting by match percentage.
    - [ ] Test sorting by company/position.
- [ ] **Job Detail View**:
    - [ ] Verify clicking on a job displays its detailed information.
    - [ ] Ensure all fields from the scraping are visible and correctly formatted.
- [ ] **Assessment Banner**:
    - [ ] Verify the assessment banner appears for jobs with pending assessments.
    - [ ] Test clicking the banner navigates to the correct assessment link.
- [ ] **Match Feedback**:
    - [ ] Verify user can provide feedback on match accuracy.
    - [ ] Test if feedback influences future matching (if implemented).

## 4. Persistencia (Guardado de estados, Sincronización)

### Sanity Tests
- [ ] Verify status change (e.g., from "Pendiente" to "Enviada") persists after refresh.
- [ ] Verify new scraped jobs are saved to the database.

### Feature Tests
- [ ] **Status Persistence**: Test that all status changes are correctly saved and loaded.
- [ ] **Data Integrity**: Verify no data loss occurs after application restarts or updates.
- [ ] **Synchronization**:
    - [ ] If applicable, test synchronization between local data and a remote source (e.g., a cloud database).
    - [ ] Handle concurrent updates and verify data consistency.
- [ ] **Error Handling (Persistence)**: Simulate database connection issues or write errors and verify data recovery/notifications.
- [ ] **Backup/Restore**: If applicable, test backup and restore functionalities.
