#pragma once
#include <any>
#include <cstdint>
#include <functional>
#include <future>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>
namespace bitwire {
using Atom = std::vector<std::uint8_t>;
class Value {
  std::variant<Atom, std::vector<Value>> data_;
public:
  explicit Value(Atom bytes): data_(std::move(bytes)) {}
  explicit Value(std::vector<Value> items): data_(std::move(items)) {}
  bool is_atom() const { return std::holds_alternative<Atom>(data_); }
  const Atom& bytes() const { return std::get<Atom>(data_); }
  const std::vector<Value>& items() const { return std::get<std::vector<Value>>(data_); }
  bool operator==(const Value&) const = default;
};
using Path = std::vector<Atom>;
struct Termination { enum class Kind { closed, failed }; Kind kind; std::string message; };
class Wire {
public:
  virtual ~Wire() = default;
  virtual std::future<void> send(Value message) = 0;
};
class Endpoint : public Wire {
public:
  virtual std::function<void()> receive(std::function<void(Value)> handler) = 0;
  virtual std::shared_future<Termination> closed() const = 0;
  virtual std::future<void> close() = 0;
};
class AddressedWire {
public:
  virtual ~AddressedWire() = default;
  virtual std::future<void> send(Path path, Value message) = 0;
};
class AddressedEndpoint : public AddressedWire {
public:
  virtual std::function<void()> receive(std::function<void(Path, Value)> handler) = 0;
  virtual std::shared_future<Termination> closed() const = 0;
  virtual std::future<void> close() = 0;
};
template<class T> class DeixisNode;
template<class T> using Children = std::vector<std::pair<Atom, std::shared_ptr<DeixisNode<T>>>>;
template<class T> struct Parts { T own; Children<T> children; };
template<class T> class DeixisNode {
public:
  virtual ~DeixisNode() = default;
  virtual T own() const = 0;
  virtual Children<T> children() const = 0;
  virtual std::shared_ptr<DeixisNode<T>> at(const Path&) const = 0;
  virtual Parts<T> decompose() const = 0;
};
using WireNode = DeixisNode<std::shared_ptr<Wire>>;
// Runtime construction captures tuples and recognizes sending faces.
class HydratedWire;
class HydratedTuple;
class HydratedValue {
  std::variant<Value, std::shared_ptr<const HydratedTuple>, std::shared_ptr<HydratedWire>> data_;
public:
  explicit HydratedValue(Value ground): data_(std::move(ground)) {}
  explicit HydratedValue(std::shared_ptr<const HydratedTuple> items): data_(std::move(items)) {}
  explicit HydratedValue(std::shared_ptr<HydratedWire> wire): data_(std::move(wire)) {}
  bool is_ground() const { return std::holds_alternative<Value>(data_); }
  bool is_tuple() const { return std::holds_alternative<std::shared_ptr<const HydratedTuple>>(data_); }
  const Value& ground() const { return std::get<Value>(data_); }
  const std::shared_ptr<const HydratedTuple>& tuple() const { return std::get<std::shared_ptr<const HydratedTuple>>(data_); }
  const std::shared_ptr<HydratedWire>& wire() const { return std::get<std::shared_ptr<HydratedWire>>(data_); }
};
class HydratedTuple {
public:
  virtual ~HydratedTuple() = default;
  virtual std::vector<HydratedValue> items() const = 0;
};
using ReceivedContext = std::shared_ptr<const std::any>;
class HydratedWire {
public:
  virtual ~HydratedWire() = default;
  virtual std::future<void> send(HydratedValue message) = 0;
};
class HydratedEndpoint : public HydratedWire {
public:
  virtual std::shared_ptr<HydratedWire> wire() const = 0;
  virtual std::function<void()> receive(std::function<void(HydratedValue, ReceivedContext)> handler) = 0;
  virtual std::shared_future<Termination> closed() const = 0;
  virtual std::future<void> close() = 0;
};
inline constexpr auto version = "0.6.0";
}
