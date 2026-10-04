# Charter

bitwire defines the shared generic envelope wire and independent contract cases.
bitruntime implements it. Neither service operation semantics nor runtime carrier
implementation enter this contract package. ontos supplies immutable ground
values and the selected codec. Exact byte paths carry connection-local routing.
No historic profile or RPC compatibility API is supported.
