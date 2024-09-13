# InvoiceItems

## Example Usage

```typescript
import { InvoiceItems } from "@vercel/sdk/models/components/authuser.js";

let value: InvoiceItems = {};
```

## Fields

| Field                                                                                                                    | Type                                                                                                                     | Required                                                                                                                 | Description                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `concurrentBuilds`                                                                                                       | [components.ConcurrentBuilds](../../models/components/concurrentbuilds.md)                                               | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `webAnalytics`                                                                                                           | [components.AuthUserWebAnalytics](../../models/components/authuserwebanalytics.md)                                       | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `pro`                                                                                                                    | [components.Pro](../../models/components/pro.md)                                                                         | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `enterprise`                                                                                                             | [components.Enterprise](../../models/components/enterprise.md)                                                           | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `analytics`                                                                                                              | [components.Analytics](../../models/components/analytics.md)                                                             | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `developerExperiencePlatform`                                                                                            | [components.DeveloperExperiencePlatform](../../models/components/developerexperienceplatform.md)                         | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `includedAllocationMiu`                                                                                                  | [components.IncludedAllocationMiu](../../models/components/includedallocationmiu.md)                                     | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `managedInfrastructureCommitment`                                                                                        | [components.ManagedInfrastructureCommitment](../../models/components/managedinfrastructurecommitment.md)                 | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `monitoring`                                                                                                             | [components.Monitoring](../../models/components/monitoring.md)                                                           | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `passwordProtection`                                                                                                     | [components.PasswordProtection](../../models/components/passwordprotection.md)                                           | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `previewDeploymentSuffix`                                                                                                | [components.PreviewDeploymentSuffix](../../models/components/previewdeploymentsuffix.md)                                 | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `saml`                                                                                                                   | [components.AuthUserSaml](../../models/components/authusersaml.md)                                                       | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `teamSeats`                                                                                                              | [components.TeamSeats](../../models/components/teamseats.md)                                                             | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `vercelMarketplace`                                                                                                      | [components.VercelMarketplace](../../models/components/vercelmarketplace.md)                                             | :heavy_minus_sign:                                                                                                       | Will be used to create an invoice item. The price must be in cents: 2000 for $20.                                        |
| `analyticsUsage`                                                                                                         | [components.AnalyticsUsage](../../models/components/analyticsusage.md)                                                   | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `artifacts`                                                                                                              | [components.Artifacts](../../models/components/artifacts.md)                                                             | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `bandwidth`                                                                                                              | [components.Bandwidth](../../models/components/bandwidth.md)                                                             | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `blobStores`                                                                                                             | [components.BlobStores](../../models/components/blobstores.md)                                                           | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `blobTotalAdvancedRequests`                                                                                              | [components.BlobTotalAdvancedRequests](../../models/components/blobtotaladvancedrequests.md)                             | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `blobTotalAvgSizeInBytes`                                                                                                | [components.BlobTotalAvgSizeInBytes](../../models/components/blobtotalavgsizeinbytes.md)                                 | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `blobTotalGetResponseObjectSizeInBytes`                                                                                  | [components.BlobTotalGetResponseObjectSizeInBytes](../../models/components/blobtotalgetresponseobjectsizeinbytes.md)     | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `blobTotalSimpleRequests`                                                                                                | [components.BlobTotalSimpleRequests](../../models/components/blobtotalsimplerequests.md)                                 | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `buildMinute`                                                                                                            | [components.BuildMinute](../../models/components/buildminute.md)                                                         | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `dataCacheRead`                                                                                                          | [components.DataCacheRead](../../models/components/datacacheread.md)                                                     | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `dataCacheRevalidation`                                                                                                  | [components.DataCacheRevalidation](../../models/components/datacacherevalidation.md)                                     | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `dataCacheWrite`                                                                                                         | [components.DataCacheWrite](../../models/components/datacachewrite.md)                                                   | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `edgeConfigRead`                                                                                                         | [components.EdgeConfigRead](../../models/components/edgeconfigread.md)                                                   | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `edgeConfigWrite`                                                                                                        | [components.EdgeConfigWrite](../../models/components/edgeconfigwrite.md)                                                 | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `edgeFunctionExecutionUnits`                                                                                             | [components.EdgeFunctionExecutionUnits](../../models/components/edgefunctionexecutionunits.md)                           | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `edgeMiddlewareInvocations`                                                                                              | [components.EdgeMiddlewareInvocations](../../models/components/edgemiddlewareinvocations.md)                             | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `edgeRequest`                                                                                                            | [components.EdgeRequest](../../models/components/edgerequest.md)                                                         | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `edgeRequestAdditionalCpuDuration`                                                                                       | [components.EdgeRequestAdditionalCpuDuration](../../models/components/edgerequestadditionalcpuduration.md)               | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `fastDataTransfer`                                                                                                       | [components.FastDataTransfer](../../models/components/fastdatatransfer.md)                                               | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `fastOriginTransfer`                                                                                                     | [components.FastOriginTransfer](../../models/components/fastorigintransfer.md)                                           | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `functionDuration`                                                                                                       | [components.FunctionDuration](../../models/components/functionduration.md)                                               | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `functionInvocation`                                                                                                     | [components.FunctionInvocation](../../models/components/functioninvocation.md)                                           | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `logDrainsVolume`                                                                                                        | [components.LogDrainsVolume](../../models/components/logdrainsvolume.md)                                                 | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `monitoringMetric`                                                                                                       | [components.MonitoringMetric](../../models/components/monitoringmetric.md)                                               | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `postgresComputeTime`                                                                                                    | [components.PostgresComputeTime](../../models/components/postgrescomputetime.md)                                         | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `postgresDataStorage`                                                                                                    | [components.PostgresDataStorage](../../models/components/postgresdatastorage.md)                                         | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `postgresDataTransfer`                                                                                                   | [components.PostgresDataTransfer](../../models/components/postgresdatatransfer.md)                                       | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `postgresDatabase`                                                                                                       | [components.PostgresDatabase](../../models/components/postgresdatabase.md)                                               | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `postgresWrittenData`                                                                                                    | [components.PostgresWrittenData](../../models/components/postgreswrittendata.md)                                         | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `serverlessFunctionExecution`                                                                                            | [components.ServerlessFunctionExecution](../../models/components/serverlessfunctionexecution.md)                         | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `sourceImages`                                                                                                           | [components.SourceImages](../../models/components/sourceimages.md)                                                       | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `storageRedisTotalBandwidthInBytes`                                                                                      | [components.StorageRedisTotalBandwidthInBytes](../../models/components/storageredistotalbandwidthinbytes.md)             | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `storageRedisTotalCommands`                                                                                              | [components.StorageRedisTotalCommands](../../models/components/storageredistotalcommands.md)                             | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `storageRedisTotalDailyAvgStorageInBytes`                                                                                | [components.StorageRedisTotalDailyAvgStorageInBytes](../../models/components/storageredistotaldailyavgstorageinbytes.md) | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `storageRedisTotalDatabases`                                                                                             | [components.StorageRedisTotalDatabases](../../models/components/storageredistotaldatabases.md)                           | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `wafOwaspExcessBytes`                                                                                                    | [components.WafOwaspExcessBytes](../../models/components/wafowaspexcessbytes.md)                                         | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `wafOwaspRequests`                                                                                                       | [components.WafOwaspRequests](../../models/components/wafowasprequests.md)                                               | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |
| `webAnalyticsEvent`                                                                                                      | [components.WebAnalyticsEvent](../../models/components/webanalyticsevent.md)                                             | :heavy_minus_sign:                                                                                                       | N/A                                                                                                                      |