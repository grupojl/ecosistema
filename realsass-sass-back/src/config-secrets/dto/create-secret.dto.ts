/**
 * CreateSecretDto — shape del request del cliente.
 * .value es el plaintext — nunca persiste en DB.
 * El service lo encripta y pasa campos separados al repo.
 */
export interface CreateSecretDto {
  key:          string;
  value:        string;   // plaintext — encriptado en el service, nunca en DB
  description?: string;
}
