# Custom Form Reporting PRD: GUI Query Builder and Data Conversion Strategy

### Custom Form Reporting PRD

|  |  |
| --- | --- |
| **Product area** | **Reports / Custom Forms** |
| **Audience** | Management, Product, Engineering, QA, Customer-facing teams |
| **Document owner** | @Chris Mills |
| **Status** | Final |
| **Date** | 28 July 2026 |
| **Primary recommendation** | Deliver a GUI-based query builder in the Reports tab for structured Custom Form querying as the MVP, supported by a backend background job to convert JSONB data into a flattened relational structure. |

#### Executive summary

This PRD proposes a two-stage strategy to introduce structured reporting capabilities for Custom Forms. The first release (MVP) will deliver a GUI-based query builder in the "Reports" page, allowing users to execute structured "AND" queries based on form field data types (e.g., greater than, equals, contains). To support this, a slow-running background job (Ruby migration) will convert all historical and future JSONB form responses into a queryable name-value pair relational structure.

A later extension (Phase 2) will introduce support for "OR" logic operations, PDF exports, and dynamically generated materialized views (pivot tables) if querying performance using the name-value pair structure proves insufficient at scale. This feature will be gated exclusively for Enterprise customers and accessible only by users with administrator roles.

#### 1. Problem statement

Last year, Calira introduced Custom Forms to capture critical supporting information at the point of usage or maintenance bookings. While highly successful at data capture, storing this data in raw JSONB format within the PostgreSQL database severely limited querying opportunities. Users cannot ask structured questions based on data types (e.g., $\<$, $\>$, or `BETWEEN` for numbers and dates, `CONTAINS` for strings). Currently, the only method to query this data is via a REST web service that requires a `booking_id` and returns the entire raw JSON response. This limits the ability of lab managers to extract actionable, aggregated insights from their operational data without manual parsing.

#### 2. Product strategy and phasing

|  |  |  |  |
| --- | --- | --- | --- |
| **Phase** | **Release** | **Scope** | **Reason** |
| Phase 1 | MVP | GUI query builder with "AND" conditions, JSONB to relational data conversion via background job, and CSV export. | Fastest valuable release to unlock structured reporting for Enterprise admins, addressing immediate data visibility needs. |
| Phase 2 | Extension | "OR" condition support, PDF exports, and dynamic materialized views. | Enhances query flexibility and proactively addresses potential database performance bottlenecks at scale. |

#### 3. Goals and non-goals

**Goals**

- Convert all historical JSONB data from the inception of the Custom Forms feature at the point of deployment via a slow-running Ruby migration.
- Provide a native, GUI-based query builder and report column selector within the "Reports" page.
- Enable structured querying across text, numerical, and date fields.
- Support exporting the resulting report tables to CSV format in the MVP.

**Non-goals for Phase 1 MVP**

- No support for "OR" operations in the query builder.
- No PDF export functionality (reserved as a Phase 2 stretch goal).
- No natural language querying (NLQ) capabilities; interaction is strictly via the GUI.
- No dynamic generation of materialized views (pivot tables) unless base performance fails initial acceptance criteria.

#### 4. Target users and personas

|  |  |  |
| --- | --- | --- |
| **Persona** | **Need** | **Phase** |
| Lab Admin / Org Admin | Needs to build structured reports on custom form data to monitor compliance, track failed calibrations, and assess safety incidents across the lab. | Phase 1 |
| Instructor (not sure about this one) | Needs to run specific queries on equipment they manage (e.g., verifying training record forms or incident reports). | Phase 1 |

Note: This feature is restricted to users who currently possess access to the reporting feature, namely those with administrator roles. Researchers, Students, and Guests will not have access.

#### 5. Entitlement and availability

This feature will be heavily gated. Custom Form Reporting will **only be available to Enterprise labs**. Core and Premium clients should not be able to access this feature, and the UI should show it in a locked state according to our existing gating patterns to drive Enterprise upsells.

#### 6. Phase 1 MVP: User-level Custom Form Reporting

**6.1 User value**

As an Admin, I want to build structured queries against data captured in custom forms, so that I can instantly retrieve specific subsets of bookings and the values of the form data for them (e.g., all failed calibrations, or specific hazard samples) and export them as a CSV for compliance tracking.

**6.2 User flow**

1. Admin navigates to the new "Custom Forms" tab on the Reports page.
2. Selects the specific custom form to report on (ideally this interface is version agnostic e.g. we do a select distinct field\_name field\_type from custom\_form\_fields where form\_name = 'thing') and this returns the superset of all fields that ever existed on the form.
3. Selects a custom form field to add as a query condition.
4. Selects the appropriate operator based on data type (e.g., equals, greater than, contains etc).
5. Inputs the value(s) for the condition.
6. Repeats steps 3–5 to add more conditions (all combined using "AND" logic).
7. Selects which booking properties (`booking.id`, `booking.date`, etc.) and form fields (`form.concentration.value`) should appear as columns in the final report.
8. Runs the report.
9. Views the query results in a sortable/filterable table and exports to CSV.
10. There should be an option to save the search filter criteria and report columns so you can revisit the search and run it again later.
11. There should be an option to view all the saved searches and re-run one or go to an edit page from there.
12. There should be an option to delete saved searches

**6.3 Functional requirements**

|  |  |
| --- | --- |
| **Area** | **Requirement** |
| **Data Transformation** | Execute a slow-running background Ruby migration to convert all historical JSONB data into the new Entity-Attribute-Value (EAV) table structure. |
| **Data Persistence** | Ongoing backend job to parse newly submitted custom form JSONB responses into the relational structure. |
| **Condition Logic** | Builder must support `AND` logic only. |
| **Operator Support** | See table below |
| **Table Output** | Resulting table must be sortable and filterable. |
| **Data Export** | Resulting table must be exportable to CSV. |
| **Data Security** | All relational data must remain encrypted (AES-256) at rest. |

**6.3 Operators to Support for Different Field Types**

| **Field Type (Control)** | **Data Type** | **Operators** |
| --- | --- | --- |
| Heading | String | None (no queries supported) |
| Paragraph | String | None (no queries supported) |
| Short Text | String | equals, starts with, ends with, contains (default contains) |
| Long Text | String | equals, starts with, ends with, contains (default contains) |
| Number | Float | equals, greater than, less than, between (default equals) |
| Value and Unit | Float | equals, greater than, less than, between (default equals) |
| Date and Time | Date | on, after, before, between (default on) |
| Radio Button | String | equals (default equals) |
| Drop Down | String | equals, starts with, ends with, contains (default contains) |
| Check Box | String | equals, in list (default equals) |
| Files | Binary | None (no queries supported) |

**6.4 Rough Database Structure**

The background job will map the JSONB data into a target relational table with a structure something like that shown below, allowing for typed queries to run regardless of the data type of the custom form field.

- `booking.id`
- `custom_form.id`
- `custom_form_response.id`
- `custom_form.field_id` (identifies field name and data type)
- `field.numeric_value`
- `field.string_value`
- `field.date_value`
- `field.blob_value`
- `field.unit`

Expected view structure for the form below

- Booking\_id
- Booking.owner
- Booking.start
- Booking.end
- Custom\_form.name
- Custom\_form.version
- Field.notes
- Field.incident\_type
- Field.date\_and\_time\_of\_incident
- Field.Actions\_Taken (string\_agg function)
- No column for file fields

**6.5 UI changes for MVP**

- Add a "Custom Forms" tab to the existing Reports page interface.
- Introduce a multi-step GUI query builder with dropdowns for Form Selection, Field Selection, Operator Selection, and Column Output Selection.
- Introduce a column selector for the report structure based on the properties of bookings and form responses.
- Introduce a query results preview screen with a table similar to the one used for the equipment overview table. This table should support further filtering and sorting. 
- Add a "Download CSV" button.

**6.6 MVP high level acceptance criteria**

- Only Admins in Enterprise labs can access the Custom Forms reporting tab.
- The query builder successfully executes queries matching the required business operations (e.g., finding failed Balance Calibrations in the last 3 months; finding Hazardous Sample Submissions with concentration \> 100 mg/ml).
- All conditions applied in the builder execute using strict "AND" logic.
- The historical backfill Ruby migration processes all past JSONB responses without severe performance degradation to the production database.
- Resulting data tables can be exported to CSV with accurate column headers.
- All changes must be successfully tested in non-production environments prior to release.

#### 7. Phase 2 extension: Advanced Logic & Performance

**7.1 User value**

As an Admin, I want to use "OR" logic in my queries and export results to PDF, so that I have greater flexibility in my searches and can share polished reports with stakeholders.

**7.2 Extension functional requirements (out of scope for MVP)**

|  |  |
| --- | --- |
| **Area** | **Requirement** |
| **Advanced Logic** | Query builder supports "OR" condition grouping. |
| **PDF Export** | The results table can be directly exported to a formatted PDF document. |
| **Materialized Views** | If pivot query performance on the EAV structure degrades, implement dynamic generation of materialized views (one per custom form) where data is pivoted into specific columns per field. |

#### 8. Technical considerations translated for product/management

|  |  |
| --- | --- |
| **Topic** | **Product meaning** |
| **Ruby Migration Job** | Extracting data from the existing raw JSON format into individual queryable rows requires a one-time, potentially heavy database operation. This must be executed as a slow-running background job to avoid slowing down the app for active users. |
| **Entity-Attribute-Value (EAV)** | The proposed data structure is flexible but can be slow to query if labs have massive amounts of form data. We are monitoring this; if reports load too slowly, Engineering will pivot to Phase 2's Materialized Views. |

#### 10. Risks and mitigations

|  |  |  |
| --- | --- | --- |
| **Risk** | **Impact** | **Mitigation** |
| **Database Performance during Backfill** | Slowing down the production application during the historical JSONB Ruby migration. | Schedule the background job during off-peak hours and throttle the processing rate. |
| **Complex Query Latency** | Querying across the name-value pair structure with multiple "AND" conditions might result in long load times for the final report. | Implement database indexing on `field_id`, `string_value`, `numeric_value`, and `date_value`. Keep dynamic materialized views ready as a fast-follow (Phase 2) if latency crosses acceptable thresholds. |
| **Data Privacy** | Exposing sensitive custom form data (e.g., incident reports) to unauthorized roles. | Enforce strict Role-Based Access Control (RBAC), ensuring only Administrator roles can access the reporting interface. |

#### 11. Success metrics

- **Engagement:** Increase user engagement by 20% within the first quarter post-launch.
- **Expansion/Attraction:** Enhance platform versatility to attract Enterprise customers; win at least 1 more Enterprise deal in the first 6 months post-launch compared to previous quarters.
- **Adoption:** Drive platform usage by existing customers, measured by an uptick in Monthly Active Users (MAU) of at least 5%.

#### 12. Rollout plan

|  |  |
| --- | --- |
| **Step** | **Description** |
| **Internal QA** | Test data migration, query builder accuracy, RBAC enforcement (Enterprise/Admin only), and CSV export in staging environments. |
| **General Availability** | Release to all eligible Enterprise clients. Monitor the Ruby migration background job closely for database performance spikes. |
| **Phase 2 Implementation** | Assess query latency and user feedback to determine the timeline for "OR" logic, PDF exports, and Materialized Views. |

#### 13. Indicative effort from spikes

*These estimates are indicative development-only estimates and should be validated during story refinement.*

|  |  |  |
| --- | --- | --- |
| **Area** | **Development estimate** | **QA estimate** |
| Backend: JSONB Migration & Background Job |  |  |
| Backend: Query Execution Engine & CSV Export |  |  |
| Frontend: GUI Query Builder & Reports Tab |  |  |
| **Total MVP** |  |  |

#### 14. Recommended story split

**Phase 1 MVP stories**

- **BE:** Create EAV database tables and ongoing parsing logic for new Custom Form responses.
- **BE:** Write and execute the slow-running Ruby migration background job to backfill historical JSONB data.
- **BE:** Develop query execution endpoints to handle dynamic `AND` queries across string, numerical, and date values.
- **BE/FE:** Implement CSV export functionality for report tables.
- **FE:** Build the "Custom Forms" tab within the Reports page, restricting access to Admins in Enterprise labs.
- **FE:** Develop the GUI query builder (form selection, field selection, operator, value input).
- **FE:** Build the results table with sorting, filtering, and column selection capabilities.
