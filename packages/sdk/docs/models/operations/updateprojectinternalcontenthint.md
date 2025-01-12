# UpdateProjectInternalContentHint

Similar to `contentHints`, but should not be exposed to the user.

## Example Usage

```typescript
import { UpdateProjectInternalContentHint } from "@vercel/sdk/models/operations/updateproject.js";

let value: UpdateProjectInternalContentHint = {
  type: "flags-secret",
  encryptedValue: "<value>",
};
```

## Fields

| Field                                                                                                                                                                          | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`                                                                                                                                                                         | [operations.UpdateProjectProjectsResponse200ApplicationJSONResponseBodyEnvType](../../models/operations/updateprojectprojectsresponse200applicationjsonresponsebodyenvtype.md) | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `encryptedValue`                                                                                                                                                               | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | Contains the `value` of the env variable, encrypted with a special key to make decryption possible in the subscriber Lambda.                                                   |