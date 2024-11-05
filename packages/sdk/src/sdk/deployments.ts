/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */

import { deploymentsCancelDeployment } from "../funcs/deploymentsCancelDeployment.js";
import { deploymentsCreateDeployment } from "../funcs/deploymentsCreateDeployment.js";
import { deploymentsDeleteDeployment } from "../funcs/deploymentsDeleteDeployment.js";
import { deploymentsGetDeployment } from "../funcs/deploymentsGetDeployment.js";
import { deploymentsGetDeploymentEvents } from "../funcs/deploymentsGetDeploymentEvents.js";
import { deploymentsGetDeploymentFileContents } from "../funcs/deploymentsGetDeploymentFileContents.js";
import { deploymentsGetDeployments } from "../funcs/deploymentsGetDeployments.js";
import { deploymentsListDeploymentFiles } from "../funcs/deploymentsListDeploymentFiles.js";
import { deploymentsUploadFile } from "../funcs/deploymentsUploadFile.js";
import { ClientSDK, RequestOptions } from "../lib/sdks.js";
import { FileTree } from "../models/components/filetree.js";
import {
  CancelDeploymentRequest,
  CancelDeploymentResponseBody,
} from "../models/operations/canceldeployment.js";
import {
  CreateDeploymentRequest,
  CreateDeploymentResponseBody,
} from "../models/operations/createdeployment.js";
import {
  DeleteDeploymentRequest,
  DeleteDeploymentResponseBody,
} from "../models/operations/deletedeployment.js";
import {
  GetDeploymentRequest,
  GetDeploymentResponseBody,
} from "../models/operations/getdeployment.js";
import { GetDeploymentEventsRequest } from "../models/operations/getdeploymentevents.js";
import { GetDeploymentFileContentsRequest } from "../models/operations/getdeploymentfilecontents.js";
import {
  GetDeploymentsRequest,
  GetDeploymentsResponseBody,
} from "../models/operations/getdeployments.js";
import { ListDeploymentFilesRequest } from "../models/operations/listdeploymentfiles.js";
import {
  UploadFileRequest,
  UploadFileResponseBody,
} from "../models/operations/uploadfile.js";
import { unwrapAsync } from "../types/fp.js";

export class Deployments extends ClientSDK {
  /**
   * Get deployment events
   *
   * @remarks
   * Get the build logs of a deployment by deployment ID and build ID. It can work as an infinite stream of logs or as a JSON endpoint depending on the input parameters.
   */
  async getDeploymentEvents(
    request: GetDeploymentEventsRequest,
    options?: RequestOptions,
  ): Promise<void> {
    return unwrapAsync(deploymentsGetDeploymentEvents(
      this,
      request,
      options,
    ));
  }

  /**
   * Get a deployment by ID or URL
   *
   * @remarks
   * Retrieves information for a deployment either by supplying its ID (`id` property) or Hostname (`url` property). Additional details will be included when the authenticated user or team is an owner of the deployment.
   */
  async getDeployment(
    request: GetDeploymentRequest,
    options?: RequestOptions,
  ): Promise<GetDeploymentResponseBody> {
    return unwrapAsync(deploymentsGetDeployment(
      this,
      request,
      options,
    ));
  }

  /**
   * Create a new deployment
   *
   * @remarks
   * Create a new deployment with all the required and intended data. If the deployment is not a git deployment, all files must be provided with the request, either referenced or inlined. Additionally, a deployment id can be specified to redeploy a previous deployment.
   */
  async createDeployment(
    request: CreateDeploymentRequest,
    options?: RequestOptions,
  ): Promise<CreateDeploymentResponseBody> {
    return unwrapAsync(deploymentsCreateDeployment(
      this,
      request,
      options,
    ));
  }

  /**
   * Cancel a deployment
   *
   * @remarks
   * This endpoint allows you to cancel a deployment which is currently building, by supplying its `id` in the URL.
   */
  async cancelDeployment(
    request: CancelDeploymentRequest,
    options?: RequestOptions,
  ): Promise<CancelDeploymentResponseBody> {
    return unwrapAsync(deploymentsCancelDeployment(
      this,
      request,
      options,
    ));
  }

  /**
   * Upload Deployment Files
   *
   * @remarks
   * Before you create a deployment you need to upload the required files for that deployment. To do it, you need to first upload each file to this endpoint. Once that's completed, you can create a new deployment with the uploaded files. The file content must be placed inside the body of the request. In the case of a successful response you'll receive a status code 200 with an empty body.
   */
  async uploadFile(
    request: UploadFileRequest,
    options?: RequestOptions,
  ): Promise<UploadFileResponseBody> {
    return unwrapAsync(deploymentsUploadFile(
      this,
      request,
      options,
    ));
  }

  /**
   * List Deployment Files
   *
   * @remarks
   * Allows to retrieve the file structure of a deployment by supplying the deployment unique identifier.
   */
  async listDeploymentFiles(
    request: ListDeploymentFilesRequest,
    options?: RequestOptions,
  ): Promise<Array<FileTree>> {
    return unwrapAsync(deploymentsListDeploymentFiles(
      this,
      request,
      options,
    ));
  }

  /**
   * Get Deployment File Contents
   *
   * @remarks
   * Allows to retrieve the content of a file by supplying the file identifier and the deployment unique identifier. The response body will contain a JSON response containing the contents of the file encoded as base64.
   */
  async getDeploymentFileContents(
    request: GetDeploymentFileContentsRequest,
    options?: RequestOptions,
  ): Promise<void> {
    return unwrapAsync(deploymentsGetDeploymentFileContents(
      this,
      request,
      options,
    ));
  }

  /**
   * List deployments
   *
   * @remarks
   * List deployments under the authenticated user or team. If a deployment hasn't finished uploading (is incomplete), the `url` property will have a value of `null`.
   */
  async getDeployments(
    request: GetDeploymentsRequest,
    options?: RequestOptions,
  ): Promise<GetDeploymentsResponseBody> {
    return unwrapAsync(deploymentsGetDeployments(
      this,
      request,
      options,
    ));
  }

  /**
   * Delete a Deployment
   *
   * @remarks
   * This API allows you to delete a deployment, either by supplying its `id` in the URL or the `url` of the deployment as a query parameter. You can obtain the ID, for example, by listing all deployments.
   */
  async deleteDeployment(
    request: DeleteDeploymentRequest,
    options?: RequestOptions,
  ): Promise<DeleteDeploymentResponseBody> {
    return unwrapAsync(deploymentsDeleteDeployment(
      this,
      request,
      options,
    ));
  }
}
