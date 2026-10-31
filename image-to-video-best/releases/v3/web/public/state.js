export function createRevisionGate() {
  let revision=0,sequence=0;
  return {get revision(){return revision;},touch(){revision++;},begin(){return {revision,sequence:++sequence};},current(ticket){return ticket.revision===revision&&ticket.sequence===sequence;}};
}
